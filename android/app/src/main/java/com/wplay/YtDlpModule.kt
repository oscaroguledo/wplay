package com.wplay

import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.FFmpegKitConfig
import com.arthenica.ffmpegkit.ReturnCode
import com.chaquo.python.PyObject
import com.chaquo.python.Python
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import dev.ffmpegkit_maintained.ytdlp.DownloadProgressCallback
import dev.ffmpegkit_maintained.ytdlp.YtDlp
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

/**
 * Downloads the audio of a URL with the embedded yt-dlp, converts it to a tagged MP3 with
 * FFmpegKit, publishes it to the shared `Download/Music` folder and records it in the library.
 *
 * yt-dlp is driven through a small Python function rather than the library's Java wrapper,
 * because the wrapper returns neither the output path nor any metadata.
 */
class YtDlpModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  // One job at a time: the embedded Python interpreter is shared process-wide.
  private val executor = Executors.newSingleThreadExecutor()
  private var runner: PyObject? = null

  private val libraryFile by lazy { File(context.filesDir, "library.json") }
  private val coversDir by lazy { File(context.filesDir, "covers").apply { mkdirs() } }

  override fun getName() = NAME

  private fun emit(stage: String, progress: Double, eta: Double = -1.0) {
    if (!context.hasActiveReactInstance()) return
    context.emitDeviceEvent(
        EVENT,
        Arguments.createMap().apply {
          putString("stage", stage)
          putDouble("progress", progress)
          putDouble("eta", eta)
        },
    )
  }

  private fun pythonRunner(): PyObject {
    runner?.let { return it }
    YtDlp.init(context.applicationContext) // starts the Python runtime on first use
    val builtins = Python.getInstance().builtins
    val globals = builtins.callAttr("dict")
    globals.callAttr("__setitem__", "YTDLP_PATH", bundledYtDlp()?.absolutePath ?: "")
    builtins.callAttr("exec", PY_SRC, globals)
    return globals.callAttr("get", "run").also { runner = it }
  }

  /**
   * The library ships an old yt-dlp that YouTube rejects. A newer yt-dlp wheel placed in
   * `assets/pylibs` is copied to internal storage here and put first on Python's import path
   * (a wheel is a zip, which Python imports from directly). To update yt-dlp, replace that file.
   */
  private fun bundledYtDlp(): File? =
      try {
        val name =
            context.assets.list("pylibs")?.filter { it.startsWith("yt_dlp") && it.endsWith(".whl") }
                ?.maxOrNull()
        if (name == null) null
        else {
          val dir = File(context.filesDir, "pylibs").apply { mkdirs() }
          val target = File(dir, name)
          if (!target.exists()) {
            dir.listFiles()?.forEach { it.delete() } // drop older copies
            val tmp = File(dir, "$name.tmp")
            context.assets.open("pylibs/$name").use { input ->
              tmp.outputStream().use { input.copyTo(it) }
            }
            tmp.renameTo(target)
          }
          target
        }
      } catch (e: Exception) {
        null
      }

  // region Library index

  @Synchronized
  private fun readLibrary(): JSONArray =
      try {
        if (libraryFile.exists()) JSONArray(libraryFile.readText()) else JSONArray()
      } catch (e: Exception) {
        JSONArray()
      }

  @Synchronized
  private fun writeLibrary(tracks: JSONArray) {
    val tmp = File(libraryFile.parentFile, "library.json.tmp")
    tmp.writeText(tracks.toString())
    tmp.renameTo(libraryFile)
  }

  private fun toMap(t: JSONObject): WritableMap =
      Arguments.createMap().apply {
        for (key in listOf("id", "title", "artist", "album", "uri", "cover", "source", "site",
            "fileName", "folder")) {
          putString(key, t.optString(key, "").ifEmpty { null })
        }
        putDouble("duration", t.optDouble("duration", 0.0))
        putDouble("size", t.optDouble("size", 0.0))
        putDouble("addedAt", t.optDouble("addedAt", 0.0))
        putDouble("year", t.optDouble("year", 0.0))
        putString("category", t.optString("category", "").ifEmpty { null })
        putDouble("playCount", t.optDouble("playCount", 0.0))
        putDouble("lastPlayedAt", t.optDouble("lastPlayedAt", 0.0))
        putBoolean("liked", t.optBoolean("liked", false))
        putString("lyrics", t.optString("lyrics", "").ifEmpty { null })
        putString("tags", t.optString("tags", "").ifEmpty { null })
        putString("metaGenre", t.optString("metaGenre", "").ifEmpty { null })
        putString("genres", t.optString("genres", "").ifEmpty { null })
        putString("genreSource", t.optString("genreSource", "").ifEmpty { null })
        putDouble("genreConfidence", t.optDouble("genreConfidence", 0.0))
      }

  /** Applies [change] to the track with this id and saves the library. */
  private fun mutate(id: String, promise: Promise, change: (JSONObject) -> Unit) {
    try {
      var found: JSONObject? = null
      synchronized(this) {
        val all = readLibrary()
        for (i in 0 until all.length()) {
          val t = all.getJSONObject(i)
          if (t.optString("id") == id) {
            change(t)
            found = t
          }
        }
        if (found != null) writeLibrary(all)
      }
      promise.resolve(found?.let { toMap(it) })
    } catch (e: Exception) {
      promise.reject("UPDATE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setCategory(id: String, category: String, promise: Promise) =
      mutate(id, promise) { it.put("category", category) }

  /** Merges user-editable fields (given as a JSON object) into a track. */
  @ReactMethod
  fun setTrackFields(id: String, json: String, promise: Promise) =
      mutate(id, promise) { track ->
        val fields = JSONObject(json)
        for (key in listOf("category", "genres", "liked", "lyrics", "genreSource", "genreConfidence")) {
          if (fields.has(key)) track.put(key, fields.get(key))
        }
      }

  // region Genre model

  /*
   * Genre detection uses Discogs-EffNet (Essentia / Music Technology Group, UPF; licensed
   * CC BY-NC-SA 4.0, i.e. non-commercial use only). It scores 400 Discogs music styles from a
   * log-mel spectrogram. The spectrogram below reproduces Essentia's TensorflowInputMusiCNN
   * exactly (checked against Essentia to 1e-5): 16 kHz mono, 512-sample Hann frames every 256
   * samples, power spectrum, Essentia's own 96-band mel filterbank (shipped as an asset), then
   * log10(1 + 10000·x). The model takes patches of 128 frames.
   */
  private var genreSession: OrtSession? = null

  private val genreClasses: List<String> by lazy {
    val array = JSONArray(context.assets.open("discogs_classes.json").bufferedReader().use { it.readText() })
    (0 until array.length()).map { array.getString(it) }
  }

  /** Mel filterbank weights, 96 bands × 257 spectrum bins, row-major. */
  private val melFilters: FloatArray by lazy {
    val bytes = context.assets.open("mel_filterbank_96x257.f32").use { it.readBytes() }
    FloatArray(MEL_BANDS * SPECTRUM_BINS).also {
      ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(it)
    }
  }

  /** For each band, the first and last spectrum bin with a non-zero weight. */
  private val melRanges: Array<IntArray> by lazy {
    Array(MEL_BANDS) { band ->
      var first = SPECTRUM_BINS
      var last = -1
      for (bin in 0 until SPECTRUM_BINS) {
        if (melFilters[band * SPECTRUM_BINS + bin] != 0f) {
          if (bin < first) first = bin
          last = bin
        }
      }
      intArrayOf(first, last)
    }
  }

  private val hann = DoubleArray(FRAME) { 0.5 - 0.5 * Math.cos(2 * Math.PI * it / (FRAME - 1)) }
  private val fftCos = DoubleArray(FRAME / 2) { Math.cos(-2 * Math.PI * it / FRAME) }
  private val fftSin = DoubleArray(FRAME / 2) { Math.sin(-2 * Math.PI * it / FRAME) }
  private val bitReversed =
      IntArray(FRAME) { Integer.reverse(it) ushr (32 - Integer.numberOfTrailingZeros(FRAME)) }

  private fun genreModel(): OrtSession =
      genreSession
          ?: run {
            val bytes = context.assets.open("discogs_effnet.onnx").use { it.readBytes() }
            OrtEnvironment.getEnvironment()
                .createSession(bytes, OrtSession.SessionOptions())
                .also { genreSession = it }
          }

  /** In-place radix-2 FFT of one frame. */
  private fun fft(re: DoubleArray, im: DoubleArray) {
    for (i in 0 until FRAME) {
      val j = bitReversed[i]
      if (j > i) {
        val t = re[i]; re[i] = re[j]; re[j] = t
      }
    }
    var size = 2
    while (size <= FRAME) {
      val half = size / 2
      val step = FRAME / size
      var start = 0
      while (start < FRAME) {
        for (k in 0 until half) {
          val c = fftCos[k * step]
          val s = fftSin[k * step]
          val a = start + k
          val b = a + half
          val tr = re[b] * c - im[b] * s
          val ti = re[b] * s + im[b] * c
          re[b] = re[a] - tr; im[b] = im[a] - ti
          re[a] += tr; im[a] += ti
        }
        start += size
      }
      size *= 2
    }
  }

  /** Log-mel frames of 16 kHz mono audio, [frames][96]. */
  private fun melFrames(samples: FloatArray): Array<FloatArray> {
    val count = if (samples.size < FRAME) 0 else (samples.size - FRAME) / HOP + 1
    val re = DoubleArray(FRAME)
    val im = DoubleArray(FRAME)
    val power = DoubleArray(SPECTRUM_BINS)
    return Array(count) { f ->
      val offset = f * HOP
      for (i in 0 until FRAME) {
        re[i] = samples[offset + i] * hann[i]
        im[i] = 0.0
      }
      fft(re, im)
      for (bin in 0 until SPECTRUM_BINS) power[bin] = re[bin] * re[bin] + im[bin] * im[bin]
      FloatArray(MEL_BANDS) { band ->
        var sum = 0.0
        val row = band * SPECTRUM_BINS
        for (bin in melRanges[band][0]..melRanges[band][1]) sum += melFilters[row + bin] * power[bin]
        Math.log10(1 + 10000 * sum).toFloat()
      }
    }
  }

  /**
   * Listens to three 20-second stretches of a track and resolves the model's average score
   * (0–1) for each Discogs style it recognised, best first, as "Genre---Style" labels. Turning
   * those into the app's genres is done on the JS side.
   */
  @ReactMethod
  fun detectGenre(id: String, promise: Promise) {
    executor.execute {
      val workDir = File(context.cacheDir, "genre/${UUID.randomUUID()}").apply { mkdirs() }
      try {
        val all = readLibrary()
        val track =
            (0 until all.length()).map { all.getJSONObject(it) }.firstOrNull { it.optString("id") == id }
        if (track == null) {
          promise.reject("NOT_FOUND", "Track not found")
          return@execute
        }
        val uri = Uri.parse(track.optString("uri"))
        val duration = track.optDouble("duration", 0.0)
        val starts =
            if (duration > 90) listOf(0.15, 0.45, 0.75).map { it * duration } else listOf(0.0, 30.0, 60.0)

        val session = genreModel()
        val inputName = session.inputNames.first()
        val sums = DoubleArray(genreClasses.size)
        var patches = 0

        for ((index, start) in starts.withIndex()) {
          val pcm = File(workDir, "$index.raw")
          // A fresh SAF handle is needed for every FFmpeg run on a content:// URI.
          val source =
              if (uri.scheme == "content") FFmpegKitConfig.getSafParameterForRead(context, uri)
              else uri.path ?: continue
          val ffmpeg =
              FFmpegKit.executeWithArguments(
                  arrayOf(
                      "-y", "-ss", "%.2f".format(java.util.Locale.US, start), "-t", "20",
                      "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le",
                      pcm.absolutePath,
                  ))
          if (!ReturnCode.isSuccess(ffmpeg.returnCode) || !pcm.isFile) continue
          val bytes = pcm.readBytes()
          pcm.delete()
          val samples = FloatArray(bytes.size / 4)
          ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(samples)

          val mel = melFrames(samples)
          val n = if (mel.size < PATCH) 0 else (mel.size - PATCH) / PATCH_HOP + 1
          if (n == 0) continue
          val input = FloatBuffer.allocate(n * PATCH * MEL_BANDS)
          for (p in 0 until n) for (f in 0 until PATCH) input.put(mel[p * PATCH_HOP + f])
          input.rewind()

          OnnxTensor.createTensor(
                  OrtEnvironment.getEnvironment(), input, longArrayOf(n.toLong(), PATCH.toLong(), MEL_BANDS.toLong()))
              .use { tensor ->
                session.run(mapOf(inputName to tensor)).use { result ->
                  // The model has two outputs; the 400-wide one holds the style scores.
                  for (entry in result) {
                    val value = entry.value.value
                    if (value is Array<*> && (value.firstOrNull() as? FloatArray)?.size == sums.size) {
                      for (row in value) {
                        row as FloatArray
                        for (i in sums.indices) sums[i] += row[i].toDouble()
                      }
                      patches += value.size
                    }
                  }
                }
              }
        }
        if (patches == 0) {
          promise.reject("ANALYSIS_FAILED", "Could not read the audio for analysis")
          return@execute
        }

        val scored =
            sums.indices
                .map { genreClasses[it] to sums[it] / patches }
                .filter { it.second > 0.01 }
                .sortedByDescending { it.second }
                .take(40)
        promise.resolve(
            Arguments.createArray().apply {
              scored.forEach { (label, score) ->
                pushMap(
                    Arguments.createMap().apply {
                      putString("label", label)
                      putDouble("score", score)
                    })
              }
            })
      } catch (e: Throwable) {
        promise.reject("ANALYSIS_FAILED", e.message ?: "Genre analysis failed", e)
      } finally {
        workDir.deleteRecursively()
      }
    }
  }

  // endregion

  // Small JSON documents owned by the JS side (e.g. playlists), one file per key.
  private fun dataFile(key: String) =
      File(context.filesDir, "data_${key.replace(Regex("[^A-Za-z0-9_]"), "_")}.json")

  @ReactMethod
  fun getData(key: String, promise: Promise) {
    try {
      val file = dataFile(key)
      promise.resolve(if (file.exists()) file.readText() else null)
    } catch (e: Exception) {
      promise.reject("READ_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setData(key: String, value: String, promise: Promise) {
    try {
      val file = dataFile(key)
      val tmp = File(file.parentFile, "${file.name}.tmp")
      tmp.writeText(value)
      tmp.renameTo(file)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("WRITE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun recordPlay(id: String, promise: Promise) =
      mutate(id, promise) {
        it.put("playCount", it.optDouble("playCount", 0.0) + 1)
        it.put("lastPlayedAt", System.currentTimeMillis().toDouble())
      }

  // endregion

  @ReactMethod
  fun downloadAudio(url: String, category: String, promise: Promise) {
    val trimmed = url.trim()
    if (!trimmed.startsWith("https://")) {
      promise.reject("INVALID_URL", "A valid HTTPS URL is required")
      return
    }

    executor.execute {
      val id = UUID.randomUUID().toString()
      val workDir = File(context.cacheDir, "ytdlp/$id")
      try {
        emit("preparing", 0.0)
        val run = pythonRunner()
        workDir.mkdirs()

        val callback = DownloadProgressCallback { progress, etaSeconds, _ ->
          emit("downloading", progress.toDouble(), etaSeconds.toDouble())
        }
        val info =
            JSONObject(
                run.call(trimmed, "${workDir.absolutePath}/%(id).80B.%(ext)s", callback).toString())

        val source = File(info.optString("path"))
        if (!source.isFile) {
          promise.reject("DOWNLOAD_FAILED", "yt-dlp finished without producing a file")
          return@execute
        }

        emit("converting", 100.0)

        // Fill gaps in yt-dlp's metadata from tags embedded in the file itself.
        val tags = MediaMetadataRetriever()
        var embeddedArt: ByteArray? = null
        fun tag(key: Int) = try { tags.extractMetadata(key)?.trim()?.ifEmpty { null } } catch (e: Exception) { null }
        try { tags.setDataSource(source.absolutePath); embeddedArt = tags.embeddedPicture } catch (e: Exception) {}
        val title = info.optString("title").ifEmpty { null }
            ?.takeUnless { it == info.optString("id") && tag(MediaMetadataRetriever.METADATA_KEY_TITLE) != null }
            ?: tag(MediaMetadataRetriever.METADATA_KEY_TITLE) ?: source.nameWithoutExtension
        val artist = info.optString("artist").ifEmpty { null }
            ?: tag(MediaMetadataRetriever.METADATA_KEY_ARTIST) ?: "Unknown artist"
        val album = info.optString("album").ifEmpty { null }
            ?: tag(MediaMetadataRetriever.METADATA_KEY_ALBUM) ?: ""
        // Genre as stated by the source site, or else by the file's own tags.
        val metaGenre = info.optString("genre").ifEmpty { null }
            ?: tag(MediaMetadataRetriever.METADATA_KEY_GENRE) ?: ""
        var duration = info.optDouble("duration", 0.0)
        if (duration <= 0) {
          duration = (tag(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0) / 1000
        }
        try { tags.release() } catch (e: Exception) {}

        val cover = saveCover(id, info.optString("thumbnail"), embeddedArt)

        val mp3 = File(workDir, "out.mp3")
        val args = mutableListOf("-y", "-i", source.absolutePath)
        if (cover != null) args += listOf("-i", cover.absolutePath)
        args += listOf("-map", "0:a:0")
        if (cover != null) {
          args += listOf("-map", "1:v:0", "-c:v", "copy", "-disposition:v", "attached_pic",
              "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)")
        }
        // Already-MP3 sources are copied as-is rather than re-encoded.
        args += if (source.extension.equals("mp3", true)) listOf("-c:a", "copy")
            else listOf("-c:a", "libmp3lame", "-q:a", "2")
        args += listOf("-map_metadata", "-1", "-id3v2_version", "3",
            "-metadata", "title=$title", "-metadata", "artist=$artist")
        if (album.isNotEmpty()) args += listOf("-metadata", "album=$album")
        args += mp3.absolutePath

        var session = FFmpegKit.executeWithArguments(args.toTypedArray())
        if (!ReturnCode.isSuccess(session.returnCode) && cover != null) {
          // Retry without embedded artwork; the cover is still shown in-app from its own file.
          session = FFmpegKit.executeWithArguments(arrayOf(
              "-y", "-i", source.absolutePath, "-vn", "-c:a", "libmp3lame", "-q:a", "2",
              "-id3v2_version", "3", "-metadata", "title=$title", "-metadata", "artist=$artist",
              mp3.absolutePath))
        }
        if (!ReturnCode.isSuccess(session.returnCode)) {
          cover?.delete()
          promise.reject("CONVERSION_FAILED", session.output?.takeLast(500) ?: "MP3 conversion failed")
          return@execute
        }

        // Many sites already put the artist in the title; don't repeat it in the file name.
        val titleHasArtist = title.contains(artist, ignoreCase = true)
        val base = (if (artist == "Unknown artist" || titleHasArtist) title else "$artist - $title")
            .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), " ").replace(Regex("\\s+"), " ").trim().take(120)
            .ifEmpty { "track" }
        val (uri, folder, fileName) = publish(mp3, "$base.mp3")

        val track = JSONObject().apply {
          put("id", id)
          put("title", title)
          put("artist", artist)
          put("album", album)
          put("duration", duration)
          put("uri", uri)
          put("fileName", fileName)
          put("folder", folder)
          put("cover", cover?.absolutePath ?: "")
          put("source", info.optString("webpage_url").ifEmpty { trimmed })
          put("site", info.optString("site"))
          put("year", info.optDouble("year", 0.0))
          put("size", mp3.length().toDouble())
          put("addedAt", System.currentTimeMillis().toDouble())
          put("category", category)
          put("tags", info.optString("tags"))
          put("metaGenre", metaGenre)
          put("playCount", 0)
          put("lastPlayedAt", 0)
        }
        synchronized(this) {
          val all = readLibrary()
          val next = JSONArray().put(track)
          for (i in 0 until all.length()) next.put(all.get(i))
          writeLibrary(next)
        }
        promise.resolve(toMap(track))
      } catch (e: Throwable) {
        promise.reject("DOWNLOAD_ERROR", cleanError(e.message), e)
      } finally {
        workDir.deleteRecursively()
      }
    }
  }

  private fun cleanError(message: String?): String =
      (message ?: "Download failed")
          .lineSequence().firstOrNull { it.isNotBlank() }.orEmpty()
          .removePrefix("DownloadError: ").removePrefix("ERROR: ")
          .ifEmpty { "Download failed" }

  /** Saves a square JPEG cover from the thumbnail URL, or else from artwork embedded in the file. */
  private fun saveCover(id: String, thumbnailUrl: String, embedded: ByteArray?): File? {
    val bytes =
        (if (thumbnailUrl.startsWith("http")) {
          try {
            val conn = URL(thumbnailUrl).openConnection() as HttpURLConnection
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.inputStream.use { it.readBytes() }
          } catch (e: Exception) {
            null
          }
        } else null) ?: embedded ?: return null
    return try {
      val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
      val side = minOf(bitmap.width, bitmap.height)
      val square =
          Bitmap.createBitmap(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side)
      val scaled = if (side > 720) Bitmap.createScaledBitmap(square, 720, 720, true) else square
      File(coversDir, "$id.jpg").also { out ->
        FileOutputStream(out).use { scaled.compress(Bitmap.CompressFormat.JPEG, 90, it) }
      }
    } catch (e: Exception) {
      null
    }
  }

  /** Copies the MP3 into shared storage. Returns (playable uri, folder label, file name). */
  private fun publish(mp3: File, name: String): Triple<String, String, String> {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val resolver = context.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, name)
        put(MediaStore.MediaColumns.MIME_TYPE, "audio/mpeg")
        put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Music")
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }
      val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: throw IllegalStateException("Could not create a file in Download/Music")
      try {
        resolver.openOutputStream(uri)!!.use { out -> mp3.inputStream().use { it.copyTo(out) } }
        resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
      } catch (e: Exception) {
        resolver.delete(uri, null, null)
        throw e
      }
      val finalName =
          resolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use {
            if (it.moveToFirst()) it.getString(0) else null
          } ?: name
      return Triple(uri.toString(), "Download/Music", finalName)
    }
    // Android 9 and older: shared storage needs a runtime permission, so stay app-private.
    val dir = (context.getExternalFilesDir("Music") ?: File(context.filesDir, "Music")).apply { mkdirs() }
    val target = File(dir, name)
    mp3.copyTo(target, overwrite = true)
    return Triple(Uri.fromFile(target).toString(), "Android/data/${context.packageName}/files/Music", name)
  }

  @ReactMethod
  fun getLibrary(promise: Promise) {
    val all = readLibrary()
    promise.resolve(
        Arguments.createArray().apply {
          for (i in 0 until all.length()) pushMap(toMap(all.getJSONObject(i)))
        })
  }

  @ReactMethod
  fun deleteTrack(id: String, promise: Promise) {
    executor.execute {
      try {
        synchronized(this) {
          val all = readLibrary()
          val keep = JSONArray()
          for (i in 0 until all.length()) {
            val t = all.getJSONObject(i)
            if (t.optString("id") != id) {
              keep.put(t)
              continue
            }
            val uri = Uri.parse(t.optString("uri"))
            try {
              if (uri.scheme == "content") context.contentResolver.delete(uri, null, null)
              else uri.path?.let { File(it).delete() }
            } catch (e: Exception) {}
            t.optString("cover").takeIf { it.isNotEmpty() }?.let { File(it).delete() }
          }
          writeLibrary(keep)
        }
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DELETE_FAILED", e.message, e)
      }
    }
  }

  // Required by NativeEventEmitter.
  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "YtDlpModule"
    const val EVENT = "YtDlpProgress"

    // Genre model input, fixed by how the model was trained.
    private const val FRAME = 512
    private const val HOP = 256
    private const val SPECTRUM_BINS = FRAME / 2 + 1
    private const val MEL_BANDS = 96
    private const val PATCH = 128
    private const val PATCH_HOP = 64

    private val PY_SRC =
        """
import sys
if YTDLP_PATH and YTDLP_PATH not in sys.path:
    sys.path.insert(0, YTDLP_PATH)
import json
import yt_dlp
import yt_dlp.version
print('wplay: using yt-dlp', yt_dlp.version.__version__, 'from', yt_dlp.__file__)


def run(url, outtmpl, cb):
    def hook(d):
        try:
            if d.get('status') == 'downloading':
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                done = d.get('downloaded_bytes') or 0
                pct = (done * 100.0 / total) if total else 0.0
                cb.onProgressUpdate(float(pct), int(d.get('eta') or -1), '')
        except Exception:
            pass

    opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'outtmpl': outtmpl,
        'noplaylist': True,
        'restrictfilenames': True,
        'progress_hooks': [hook],
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info.get('entries'):
            info = next((e for e in info['entries'] if e), info)
        downloads = info.get('requested_downloads') or []
        path = downloads[0].get('filepath') if downloads else ydl.prepare_filename(info)

    artists = info.get('artists') or []
    year = info.get('release_year') or (info.get('upload_date') or '')[:4] or 0
    return json.dumps({
        'path': path,
        'id': str(info.get('id') or ''),
        'title': info.get('track') or info.get('title') or '',
        'artist': info.get('artist') or ', '.join(artists) or info.get('creator')
                  or info.get('uploader') or info.get('channel') or '',
        'album': info.get('album') or '',
        'duration': float(info.get('duration') or 0),
        'thumbnail': info.get('thumbnail') or '',
        'webpage_url': info.get('webpage_url') or '',
        'site': info.get('extractor_key') or '',
        'year': int(year or 0),
        'genre': str(info.get('genre') or ', '.join(info.get('genres') or []) or ''),
        # Genre-ish words, used by the app to suggest a category.
        'tags': ' '.join(str(x) for x in (
            [info.get('genre') or ''] + (info.get('genres') or [])
            + (info.get('categories') or []) + (info.get('tags') or [])[:25]) if x)[:600],
    })
"""
            .trimIndent()
  }
}
