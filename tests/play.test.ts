import { describe, expect, it } from 'vitest';
import { WORDS, DICTIONARY, wordPool } from '../src/data/words';
import { SENTENCES } from '../src/data/sentences';
import { PUZZLES } from '../src/data/puzzles';
import { glyphFor } from '../src/data/glyphs';
import { lintSentence } from '../src/lang/grammar';
import { wordsIn } from '../src/lang/tokenize';
import { dailySentence, garden, hash, judgePuzzle, markDaily, practiceCalendar, puzzleTiles } from '../src/engine/play';
import { prepare, rank, type Pt } from '../src/engine/recognizer';
import { samplePath } from '../src/engine/pathSample';
import { Rating, emptySrs, introduce, review, cardId, fromJSON, toJSON } from '../src/engine/srs';

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = wordPool(WORDS, { includeKu: false, includeSensitive: false });
const TEMPLATES = POOL.map((w) => ({ item: w.id, points: prepare(samplePath(glyphFor(w.glyph)!.d)) }));

describe('puzzles.yaml', () => {
  it('every accepted answer uses known words and passes the linter', () => {
    const bad = PUZZLES.flatMap((p) =>
      p.accept.flatMap((a) => [
        ...wordsIn(a).filter((w) => !DICTIONARY.has(w)).map((w) => `${p.en}: "${a}" unknown ${w}`),
        ...lintSentence(a, DICTIONARY).map((i) => `${p.en}: "${a}" → ${i.rule}`),
      ]),
    );
    expect(bad).toEqual([]);
    expect(new Set(PUZZLES.map((p) => p.en)).size).toBe(PUZZLES.length);
  });

  it('accepts any listed answer and offers every tile needed', () => {
    const car = PUZZLES.find((p) => p.en === 'a car')!;
    expect(judgePuzzle(['tomo', 'tawa'], car)).toBe('accepted');
    expect(judgePuzzle(['ilo', 'tawa'], car)).toBe('accepted');
    expect(judgePuzzle(['tawa', 'tomo'], car)).toBe('other');
    for (const p of PUZZLES) {
      const tiles = puzzleTiles(p, POOL, seeded(1));
      for (const a of p.accept) for (const w of a.split(' ')) expect(tiles, p.en).toContain(w);
    }
  });
});

describe('daily toki and calendar', () => {
  it('is stable for a day and changes across days', () => {
    const s = emptySrs();
    const a = dailySentence(new Date('2026-03-01T08:00'), SENTENCES, s);
    expect(dailySentence(new Date('2026-03-01T22:00'), SENTENCES, s)).toBe(a);
    const week = new Set(Array.from({ length: 7 }, (_, i) => dailySentence(new Date(2026, 2, 1 + i, 9), SENTENCES, s).tok));
    expect(week.size).toBeGreaterThan(3);
  });

  it('prefers sentences made of words the learner has met', () => {
    let s = emptySrs();
    const now = new Date('2026-03-01T09:00');
    for (const w of ['mi', 'sina', 'pona', 'li', 'jan', 'moku', 'e', 'kili', 'telo', 'soweli', 'suli', 'lili', 'ona', 'ni', 'toki', 'ike', 'tomo', 'lon']) {
      s = introduce(s, w, 'recognise', now);
    }
    const met = new Set(Object.keys(s.cards).map((id) => id.split(':')[0]));
    for (let d = 1; d <= 10; d++) {
      const pick = dailySentence(new Date(2026, 2, d, 9), SENTENCES, s);
      expect(pick.words.every((w) => met.has(w)), pick.tok).toBe(true);
    }
  });

  it('marks practised days from reviews and daily reads, Monday-first', () => {
    const now = new Date('2026-03-12T09:00'); // a Thursday
    let s = markDaily(emptySrs(), new Date('2026-03-10T09:00'));
    s = introduce(s, 'pona', 'recognise', now);
    s = review(s, cardId('pona', 'recognise'), Rating.Good, now, 'test');
    const cal = practiceCalendar(s, now, 2);
    expect(cal).toHaveLength(14);
    expect(cal[0].date.getDay()).toBe(1);
    expect(cal.filter((d) => d.practised).map((d) => d.key)).toEqual(['2026-03-10', '2026-03-12']);
    expect(cal.find((d) => d.today)!.key).toBe('2026-03-12');
    expect(fromJSON(toJSON(s)).extras.daily).toEqual(['2026-03-10']);
  });
});

describe('garden', () => {
  it('grows one stable plant per learned word', () => {
    const now = new Date('2026-03-01T09:00');
    let s = emptySrs();
    for (const w of ['pona', 'jan', 'toki']) {
      s = introduce(s, w, 'recognise', now);
      s = review(s, cardId(w, 'recognise'), Rating.Easy, now, 'test');
    }
    s = introduce(s, 'moku', 'recognise', now); // started, not learned: no plant
    const plants = garden(s, POOL);
    expect(plants.map((p) => p.word).sort()).toEqual(['jan', 'pona', 'toki']);
    expect(garden(s, POOL)).toEqual(plants); // deterministic
    for (const p of plants) {
      expect(p.x).toBeGreaterThanOrEqual(4);
      expect(p.x).toBeLessThanOrEqual(96);
    }
    expect(hash('pona')).toBe(hash('pona'));
  });
});

describe('glyph recogniser', () => {
  const drawn = (pts: [number, number][][], jitter = 0, seed = 1): Pt[] => {
    const rng = seeded(seed);
    return pts.flatMap((stroke, id) =>
      stroke.map(([x, y]) => ({ x: x + (rng() - 0.5) * jitter, y: y + (rng() - 0.5) * jitter, id })),
    );
  };
  const circle = (cx: number, cy: number, r: number, n = 40): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)]);
  const line = (x1: number, y1: number, x2: number, y2: number, n = 20): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
  const top = (pts: Pt[], k: number) => rank(pts, TEMPLATES).slice(0, k).map((r) => r.item);

  it("recognises every glyph's own outline, rescaled and jittered, as itself", () => {
    let hits = 0;
    const sample = POOL.filter((_, i) => i % 4 === 0); // every 4th glyph keeps the test quick
    for (const w of sample) {
      const raw = samplePath(glyphFor(w.glyph)!.d).map((p) => ({ x: p.x * 3 + 40, y: p.y * 3 + 7, id: p.id }));
      const noisy = raw.map((p, i) => ({ ...p, x: p.x + Math.sin(i) * 2, y: p.y + Math.cos(i) * 2 }));
      if (top(noisy, 1)[0] === w.id) hits++;
    }
    expect(hits / sample.length).toBeGreaterThanOrEqual(0.95);
  }, 60_000);

  it('recognises hand-drawn centre-line shapes against outline templates', () => {
    // a single drawn circle → ijo (the plain circle is "thing"; sike is a circle with a ring inside)
    expect(top(drawn([circle(150, 150, 100)], 6), 3)).toContain('ijo');
    // an X drawn as two strokes → ala
    expect(top(drawn([line(60, 60, 240, 240), line(240, 60, 60, 240)], 6), 3)).toContain('ala');
    // a plus sign → en
    expect(top(drawn([line(150, 50, 150, 250), line(50, 150, 250, 150)], 6), 3)).toContain('en');
  });
});
