import { Share } from 'react-native';

import { genreSummary, shareTrack, trackDetails } from '../src/trackActions';
import { makeTrack } from './helpers/track';

describe('genreSummary', () => {
  it('lists genres with how they were decided', () => {
    expect(
      genreSummary(
        makeTrack({
          category: 'Afro',
          genres: 'Afro|Pop',
          genreSource: 'tags',
        }),
      ),
    ).toBe('Afro, Pop (from the source site’s tags)');
  });

  it('is empty for a track with no genre', () => {
    expect(genreSummary(makeTrack())).toBe('');
  });
});

describe('trackDetails', () => {
  it('leaves out rows that have no value', () => {
    const labels = trackDetails(makeTrack({ year: 0 })).map(([label]) => label);
    expect(labels).not.toContain('Album');
    expect(labels).not.toContain('Year');
    expect(labels).not.toContain('Genre');
    expect(labels).toEqual(
      expect.arrayContaining(['Artist', 'Length', 'Link', 'File', 'Size']),
    );
  });

  it('formats length and size', () => {
    const rows = Object.fromEntries(trackDetails(makeTrack()));
    expect(rows.Length).toBe('3:05');
    expect(rows.Size).toBe('4.0 MB');
  });
});

describe('shareTrack', () => {
  it('shares the title, artist and source link', () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' } as never);
    shareTrack(makeTrack());
    expect(share).toHaveBeenCalledWith({
      message: 'Test Song — Test Artist\nhttps://example.com/watch/1',
    });
    share.mockRestore();
  });
});
