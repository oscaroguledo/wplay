import {
  cleanArtist,
  cleanTitle,
  lookupGenres,
} from '../src/services/musicbrainz';

describe('cleanTitle', () => {
  it('removes video-site decorations', () => {
    expect(cleanTitle('My Song (Official Video)', 'X')).toBe('My Song');
    expect(cleanTitle('My Song [Official Audio] (Lyrics)', 'X')).toBe(
      'My Song',
    );
  });

  it('drops featured artists and a leading artist name', () => {
    expect(cleanTitle('Artist - My Song ft. Someone', 'Artist')).toBe(
      'My Song',
    );
  });

  it('keeps a dash that is part of the title', () => {
    expect(cleanTitle('Part One - Reprise', 'Artist')).toBe(
      'Part One - Reprise',
    );
  });
});

describe('cleanArtist', () => {
  it('removes channel-name suffixes', () => {
    expect(cleanArtist('Artist - Topic')).toBe('Artist');
    expect(cleanArtist('ArtistVEVO')).toBe('Artist');
  });
});

describe('lookupGenres', () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  const reply = (body: unknown, ok = true) =>
    Promise.resolve({ ok, json: () => Promise.resolve(body) });

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('uses tags on the matching recordings, most-voted first', async () => {
    fetchMock.mockReturnValueOnce(
      reply({
        recordings: [
          { score: 100, tags: [] },
          {
            score: 91,
            tags: [
              { name: 'world', count: 1 },
              { name: 'afrobeat', count: 3 },
              { name: 'not a genre', count: 9 },
            ],
          },
        ],
      }),
    );
    await expect(lookupGenres('Artist', 'Song')).resolves.toEqual([
      'Afro',
      'World',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/recording?query=');
    expect(options.headers['User-Agent']).toMatch(/^WPlay\//);
  });

  it("falls back to the artist's genres", async () => {
    fetchMock
      .mockReturnValueOnce(
        reply({
          recordings: [
            { score: 100, 'artist-credit': [{ artist: { id: 'abc' } }] },
          ],
        }),
      )
      .mockReturnValueOnce(
        reply({ genres: [{ name: 'jazz', count: 5 }], tags: [] }),
      );
    await expect(lookupGenres('Artist', 'Song')).resolves.toEqual(['Jazz']);
    expect(fetchMock.mock.calls[1][0]).toContain('/artist/abc?inc=genres');
  });

  it('ignores low-confidence matches', async () => {
    fetchMock.mockReturnValueOnce(
      reply({
        recordings: [{ score: 60, tags: [{ name: 'jazz', count: 5 }] }],
      }),
    );
    await expect(lookupGenres('Artist', 'Song')).resolves.toEqual([]);
  });

  it('returns nothing when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(lookupGenres('Artist', 'Song')).resolves.toEqual([]);
    fetchMock.mockReturnValueOnce(reply(null, false));
    await expect(lookupGenres('Artist', 'Song')).resolves.toEqual([]);
  });

  it('does not ask at all without a usable artist and title', async () => {
    await expect(lookupGenres('Unknown artist', 'Song')).resolves.toEqual([]);
    await expect(lookupGenres('Artist', '   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
