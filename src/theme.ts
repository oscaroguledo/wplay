export const colors = {
  bg: '#030303',
  surface: '#161616',
  surfaceHigh: '#212121',
  border: '#2a2a2a',
  text: '#ffffff',
  textDim: '#aaaaaa',
  textFaint: '#717171',
  /** Oxblood: fills such as buttons and selected chips (pair with white text). */
  accent: '#7d1524',
  /** Lighter oxblood for small text and icons, readable on the dark background. */
  accentSoft: '#d0505f',
  danger: '#ff6b6b',
};

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
