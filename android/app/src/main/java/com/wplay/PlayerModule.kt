package com.wplay

import android.content.ComponentName
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.google.common.util.concurrent.ListenableFuture
import java.io.File

/**
 * JS-facing remote control for [PlaybackService]. The queue and the player live in the service,
 * so playback carries on when the app is backgrounded or the JS side reloads.
 */
class PlayerModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  private val main = Handler(Looper.getMainLooper())
  private var future: ListenableFuture<MediaController>? = null
  private var controller: MediaController? = null

  private val ticker =
      object : Runnable {
        override fun run() {
          val c = controller ?: return
          if (c.isPlaying) {
            emit()
            main.postDelayed(this, 500)
          }
        }
      }

  private val listener =
      object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
          emit()
          main.removeCallbacks(ticker)
          if (player.isPlaying) main.postDelayed(ticker, 500)
        }

        override fun onPlayerError(error: PlaybackException) {
          emit(error.message ?: "Playback failed")
        }
      }

  override fun getName() = "PlayerModule"

  private fun state(c: MediaController?, error: String? = null): WritableMap =
      Arguments.createMap().apply {
        val duration = c?.duration ?: C.TIME_UNSET
        putString("id", c?.currentMediaItem?.mediaId)
        putBoolean("playing", c?.isPlaying == true)
        putBoolean("ended", c?.playbackState == Player.STATE_ENDED)
        // 0 = off, 1 = repeat one, 2 = repeat all (Player.REPEAT_MODE_*)
        putInt("repeatMode", c?.repeatMode ?: Player.REPEAT_MODE_OFF)
        putBoolean("shuffle", c?.shuffleModeEnabled == true)
        putDouble("position", (c?.currentPosition ?: 0L) / 1000.0)
        putDouble("duration", if (duration == C.TIME_UNSET) 0.0 else duration / 1000.0)
        if (error != null) putString("error", error)
      }

  private fun emit(error: String? = null) {
    if (context.hasActiveReactInstance()) {
      context.emitDeviceEvent("PlayerState", state(controller, error))
    }
  }

  /** Runs [block] on the main thread with a connected controller, connecting first if needed. */
  private fun withController(block: (MediaController) -> Unit) {
    main.post {
      controller?.let {
        block(it)
        return@post
      }
      val pending =
          future
              ?: MediaController.Builder(
                      context, SessionToken(context, ComponentName(context, PlaybackService::class.java)))
                  .buildAsync()
                  .also { future = it }
      pending.addListener(
          {
            try {
              val c = pending.get()
              if (controller == null) {
                controller = c
                c.addListener(listener)
              }
              block(c)
            } catch (e: Exception) {
              future = null
              emit("Could not start the playback service")
            }
          },
          ContextCompat.getMainExecutor(context),
      )
    }
  }

  @ReactMethod
  fun setQueue(tracks: ReadableArray, startIndex: Int, promise: Promise) {
    val items = ArrayList<MediaItem>()
    for (i in 0 until tracks.size()) {
      val t = tracks.getMap(i) ?: continue
      val uri = Uri.parse(t.getString("uri") ?: continue)
      val metadata =
          MediaMetadata.Builder()
              .setTitle(t.getString("title"))
              .setArtist(t.getString("artist"))
              .setAlbumTitle(if (t.hasKey("album")) t.getString("album") else null)
              .setArtworkUri(
                  (if (t.hasKey("cover")) t.getString("cover") else null)
                      ?.takeIf { it.isNotEmpty() }
                      ?.let { Uri.fromFile(File(it)) })
              .build()
      items +=
          MediaItem.Builder()
              .setMediaId(t.getString("id") ?: uri.toString())
              .setUri(uri)
              .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(uri).build())
              .setMediaMetadata(metadata)
              .build()
    }
    if (items.isEmpty()) {
      promise.reject("EMPTY_QUEUE", "Nothing to play")
      return
    }
    withController { c ->
      c.setMediaItems(items, startIndex.coerceIn(0, items.size - 1), 0L)
      c.prepare()
      c.play()
      promise.resolve(true)
    }
  }

  @ReactMethod fun pause() = withController { it.pause() }

  @ReactMethod
  fun resume() = withController {
    if (it.playbackState == Player.STATE_ENDED) it.seekTo(0, 0L)
    it.play()
  }

  @ReactMethod fun next() = withController { if (it.hasNextMediaItem()) it.seekToNextMediaItem() }

  // Restarts the current track unless it has only just begun, like most players.
  @ReactMethod fun previous() = withController { it.seekToPrevious() }

  @ReactMethod fun setRepeatMode(mode: Int) = withController { it.repeatMode = mode.coerceIn(0, 2) }

  @ReactMethod fun setShuffle(enabled: Boolean) = withController { it.shuffleModeEnabled = enabled }

  /** Jumps to a position in the current queue. */
  @ReactMethod
  fun skipTo(index: Int) = withController {
    if (index in 0 until it.mediaItemCount) {
      it.seekTo(index, 0L)
      it.play()
    }
  }

  @ReactMethod fun seekTo(seconds: Double) = withController { it.seekTo((seconds * 1000).toLong()) }

  @ReactMethod
  fun stop() = withController {
    it.stop()
    it.clearMediaItems()
  }

  /** Lets a freshly started JS side pick up whatever the service is already playing. */
  @ReactMethod fun getState(promise: Promise) = withController { promise.resolve(state(it)) }

  // Required by NativeEventEmitter.
  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  override fun invalidate() {
    main.post {
      main.removeCallbacks(ticker)
      controller?.removeListener(listener)
      controller = null
      future?.let { MediaController.releaseFuture(it) }
      future = null
    }
    super.invalidate()
  }
}
