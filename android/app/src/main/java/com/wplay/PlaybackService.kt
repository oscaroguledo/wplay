package com.wplay

import android.app.PendingIntent
import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Owns the player and its media session. Running as a foreground media service is what keeps
 * music playing with the app in the background and gives the system its lock-screen and
 * notification controls.
 */
class PlaybackService : MediaSessionService() {

  private var session: MediaSession? = null

  @OptIn(UnstableApi::class)
  override fun onCreate() {
    super.onCreate()
    setMediaNotificationProvider(
        DefaultMediaNotificationProvider.Builder(this).build().apply {
          setSmallIcon(R.drawable.ic_stat_wplay)
        })

    val player =
        ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus= */ true,
            )
            .setHandleAudioBecomingNoisy(true) // pause when headphones are unplugged
            .build()

    val openApp =
        PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    session =
        MediaSession.Builder(this, player)
            .setSessionActivity(openApp)
            .setCallback(
                object : MediaSession.Callback {
                  // A MediaItem loses its playable URI on the way from a controller, so it is
                  // carried in requestMetadata and restored here.
                  override fun onAddMediaItems(
                      mediaSession: MediaSession,
                      controller: MediaSession.ControllerInfo,
                      mediaItems: MutableList<MediaItem>,
                  ): ListenableFuture<MutableList<MediaItem>> =
                      Futures.immediateFuture(
                          mediaItems
                              .map { it.buildUpon().setUri(it.requestMetadata.mediaUri).build() }
                              .toMutableList())
                })
            .build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

  // Swiping the app away stops the service unless music is actually playing.
  override fun onTaskRemoved(rootIntent: Intent?) {
    val player = session?.player
    if (player == null || !player.playWhenReady || player.mediaItemCount == 0) stopSelf()
  }

  override fun onDestroy() {
    session?.run {
      player.release()
      release()
    }
    session = null
    super.onDestroy()
  }
}
