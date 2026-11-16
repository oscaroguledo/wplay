import { NativeEventEmitter, NativeModules } from 'react-native';

import type { Track } from './downloader';

export type PlayerEvent = {
  /** Id of the track the service is on, or null when the queue is empty. */
  id: string | null;
  playing: boolean;
  /** True once the last track in the queue has finished. */
  ended: boolean;
  /** Seconds. */
  position: number;
  duration: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  error?: string;
};

/** 0 = off, 1 = repeat the current song, 2 = repeat the whole queue. */
export type RepeatMode = 0 | 1 | 2;

const { PlayerModule } = NativeModules;

/** Remote control for the native playback service, which owns the queue. */
export const player = {
  setQueue: (tracks: Track[], startIndex: number): Promise<boolean> =>
    PlayerModule
      ? PlayerModule.setQueue(
          tracks.map(({ id, uri, title, artist, album, cover }) => ({
            id,
            uri,
            title,
            artist,
            album: album ?? '',
            cover: cover ?? '',
          })),
          startIndex,
        )
      : Promise.reject(new Error('Native player is unavailable')),
  pause: () => PlayerModule?.pause(),
  resume: () => PlayerModule?.resume(),
  next: () => PlayerModule?.next(),
  previous: () => PlayerModule?.previous(),
  seekTo: (seconds: number) => PlayerModule?.seekTo(seconds),
  skipTo: (index: number) => PlayerModule?.skipTo(index),
  setRepeatMode: (mode: RepeatMode) => PlayerModule?.setRepeatMode(mode),
  setShuffle: (enabled: boolean) => PlayerModule?.setShuffle(enabled),
  stop: () => PlayerModule?.stop(),
  getState: (): Promise<PlayerEvent | null> =>
    PlayerModule ? PlayerModule.getState() : Promise.resolve(null),
};

export function onPlayerState(callback: (event: PlayerEvent) => void) {
  if (!PlayerModule) {
    return () => {};
  }
  const subscription = new NativeEventEmitter(PlayerModule).addListener(
    'PlayerState',
    event => callback(event as unknown as PlayerEvent),
  );
  return () => subscription.remove();
}
