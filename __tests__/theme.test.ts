import { formatSize, formatTime } from '../src/theme';

describe('formatTime', () => {
  it('formats minutes and seconds', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(599.9)).toBe('9:59');
  });

  it('adds hours when needed', () => {
    expect(formatTime(3725)).toBe('1:02:05');
  });

  it('shows 0:00 for zero, negative and non-finite values', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(-3)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
});

describe('formatSize', () => {
  it('formats bytes as megabytes with one decimal', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(13678420)).toBe('13.0 MB');
  });
});
