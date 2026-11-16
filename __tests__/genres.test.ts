import {
  canonicalGenre,
  genreColor,
  genreFromModel,
  genreFromTags,
  GENRES,
  genreSourceLabel,
  knownGenre,
  normalizeGenre,
  trackGenres,
} from '../src/genres';
import { makeTrack } from './helpers/track';

describe('GENRES', () => {
  it('has no duplicate names', () => {
    expect(new Set(GENRES).size).toBe(GENRES.length);
  });
});

describe('normalizeGenre', () => {
  it('maps known spellings to the canonical name', () => {
    expect(normalizeGenre('Hip Hop')).toBe('Hip-Hop');
    expect(normalizeGenre('  afrobeats ')).toBe('Afro');
    expect(normalizeGenre('RNB')).toBe('R&B');
  });

  it('uses the first known part of a multi-genre string', () => {
    expect(normalizeGenre('Pop, Dance')).toBe('Pop');
    expect(normalizeGenre('Something Odd / Jazz')).toBe('Jazz');
  });

  it('keeps an unknown genre as its own, tidied', () => {
    expect(normalizeGenre('zydeco')).toBe('Zydeco');
  });

  it('rejects empty and meaningless values', () => {
    expect(normalizeGenre(null)).toBe('');
    expect(normalizeGenre('')).toBe('');
    expect(normalizeGenre('Music')).toBe('');
    expect(normalizeGenre('Unknown')).toBe('');
  });
});

describe('knownGenre and canonicalGenre', () => {
  it('knownGenre accepts only genres the app has', () => {
    expect(knownGenre('afrobeat')).toBe('Afro');
    expect(knownGenre('zydeco')).toBe('');
  });

  it('canonicalGenre follows renames and leaves other names alone', () => {
    expect(canonicalGenre('African')).toBe('Afro');
    expect(canonicalGenre('Zydeco')).toBe('Zydeco');
  });
});

describe('genreFromTags', () => {
  it('finds a genre word among loose tags', () => {
    expect(genreFromTags('Music Chella Chella Music African')).toBe('Afro');
  });

  it('prefers the longest matching spelling', () => {
    expect(genreFromTags('best afro house mix 2026')).toBe('Afro House');
  });

  it('ignores ambiguous words and partial matches', () => {
    expect(genreFromTags('mass appeal high score')).toBe('');
    expect(genreFromTags('jazzercise class')).toBe('');
  });

  it('returns nothing for no tags', () => {
    expect(genreFromTags(null)).toBe('');
    expect(genreFromTags('   ')).toBe('');
  });
});

describe('genreFromModel', () => {
  it('files a known style under its own genre', () => {
    const guess = genreFromModel([
      { label: 'Stage & Screen---Soundtrack', score: 0.25 },
      { label: 'Stage & Screen---Score', score: 0.18 },
      { label: 'Classical---Contemporary', score: 0.09 },
    ]);
    expect(guess).toEqual({ genres: ['Soundtrack'], confidence: 0.25 });
  });

  it('keeps strong secondary genres, strongest first', () => {
    const guess = genreFromModel([
      { label: 'Electronic---Ambient', score: 0.3 },
      { label: 'Electronic---Techno', score: 0.41 },
      { label: 'Jazz---Bop', score: 0.12 },
    ]);
    expect(guess?.genres).toEqual(['Techno', 'Ambient']);
    expect(guess?.confidence).toBe(0.41);
  });

  it('falls back to the parent genre for a style the app does not list', () => {
    expect(
      genreFromModel([{ label: 'Rock---Shoegaze', score: 0.5 }])?.genres,
    ).toEqual(['Rock']);
  });

  it('uses the parent for styles that only make sense with it', () => {
    expect(
      genreFromModel([{ label: 'Hip Hop---Instrumental', score: 0.5 }])?.genres,
    ).toEqual(['Hip-Hop']);
  });

  it('keeps at most three genres', () => {
    const guess = genreFromModel([
      { label: 'Jazz---Bop', score: 0.5 },
      { label: 'Blues---Delta Blues', score: 0.45 },
      { label: 'Rock---Shoegaze', score: 0.4 },
      { label: 'Pop---Ballad', score: 0.35 },
    ]);
    expect(guess?.genres).toEqual(['Jazz', 'Blues', 'Rock']);
  });

  it('gives no answer for non-music or weak scores', () => {
    expect(
      genreFromModel([{ label: 'Non-Music---Interview', score: 0.9 }]),
    ).toBeNull();
    expect(genreFromModel([{ label: 'Jazz---Bop', score: 0.02 }])).toBeNull();
    expect(genreFromModel([])).toBeNull();
  });
});

describe('trackGenres', () => {
  it('lists the main genre first, without repeats', () => {
    expect(
      trackGenres(makeTrack({ category: 'Afro', genres: 'Afro|Pop' })),
    ).toEqual(['Afro', 'Pop']);
  });

  it('works for tracks saved before secondary genres existed', () => {
    expect(trackGenres(makeTrack({ category: 'Jazz' }))).toEqual(['Jazz']);
    expect(trackGenres(makeTrack())).toEqual([]);
  });
});

describe('genreColor', () => {
  it('is stable and always a hex colour', () => {
    expect(genreColor('Afro')).toBe(genreColor('Afro'));
    GENRES.forEach(g => expect(genreColor(g)).toMatch(/^#[0-9a-f]{6}$/));
  });
});

describe('genreSourceLabel', () => {
  it('describes each source', () => {
    expect(genreSourceLabel(makeTrack({ genreSource: 'manual' }))).toBe(
      'set by you',
    );
    expect(
      genreSourceLabel(
        makeTrack({ genreSource: 'model', genreConfidence: 0.414 }),
      ),
    ).toBe('detected from the audio, 41% confidence');
    expect(genreSourceLabel(makeTrack())).toBe('');
  });
});
