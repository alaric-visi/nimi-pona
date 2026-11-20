/**
 * Content checks for the learning path. The central guarantee: a learner on the path
 * never meets a word they haven't been taught.
 */
import { describe, expect, it } from 'vitest';
import { COMPOUNDS, PHRASES, UNITS, vocabularyThrough } from '../src/data/path';
import { DICTIONARY, WORDS } from '../src/data/words';
import { glyphFor } from '../src/data/glyphs';
import { lintSentence } from '../src/lang/grammar';
import { wordsIn } from '../src/lang/tokenize';

const unknownIn = (text: string, known: Set<string>) => wordsIn(text).filter((w) => !known.has(w));

describe('units.yaml', () => {
  it('introduces all 120 pu words (and the pu synonyms) exactly once in units 1–14', () => {
    const core = UNITS.filter((u) => u.n <= 14).flatMap((u) => u.words);
    expect(new Set(core).size, 'duplicates').toBe(core.length);
    const expected = WORDS.filter((w) => w.tier !== 'ku').map((w) => w.id).sort();
    expect([...core].sort()).toEqual(expected);
  });

  it('puts every ku word in the optional beyond-pu unit', () => {
    const beyond = UNITS.filter((u) => u.optional).flatMap((u) => u.words).sort();
    expect(beyond).toEqual(WORDS.filter((w) => w.tier === 'ku').map((w) => w.id).sort());
  });

  it('every unit has a lesson with examples, a glyph, and a checkpoint with questions', () => {
    for (const u of UNITS) {
      expect(u.lesson.points.length, u.id).toBeGreaterThanOrEqual(2);
      expect(u.lesson.examples.length, u.id).toBeGreaterThanOrEqual(2);
      expect(u.checkpoint.questions.length, u.id).toBeGreaterThanOrEqual(2);
      expect(glyphFor(u.glyph), u.id).toBeDefined();
    }
  });

  it('lesson examples and stories use only words taught so far', () => {
    const problems: string[] = [];
    for (const u of UNITS) {
      const known = vocabularyThrough(u.n);
      for (const t of [...u.lesson.examples, ...u.checkpoint.lines]) {
        const unknown = unknownIn(t.tok, known);
        if (unknown.length) problems.push(`${u.id}: "${t.tok}" uses ${unknown.join(', ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("each unit's own words appear in its lesson or story", () => {
    const problems: string[] = [];
    for (const u of UNITS.filter((x) => x.n <= 14)) {
      const used = new Set([...u.lesson.examples, ...u.checkpoint.lines].flatMap((t) => wordsIn(t.tok)));
      const unused = u.words.filter((w) => !used.has(w));
      // allow a couple of words to be met only in practice
      if (unused.length > Math.ceil(u.words.length / 2)) problems.push(`${u.id}: ${unused.join(', ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('every example and story line passes the grammar linter', () => {
    const problems = UNITS.flatMap((u) =>
      [...u.lesson.examples, ...u.checkpoint.lines].flatMap((t) =>
        lintSentence(t.tok, DICTIONARY).map((i) => `${u.id}: "${t.tok}" → ${i.rule}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it('checkpoint answers are unambiguous (no duplicate options)', () => {
    for (const u of UNITS) for (const q of u.checkpoint.questions) expect(new Set(q.options).size, `${u.id}: ${q.q}`).toBe(q.options.length);
  });
});

describe('phrases.yaml', () => {
  it('each phrase unlocks only once all its words are taught, and passes the linter', () => {
    const problems = PHRASES.flatMap((p) => {
      const unknown = unknownIn(p.tok, vocabularyThrough(p.unit));
      const lint = lintSentence(p.tok, DICTIONARY).map((i) => i.rule);
      return [...(unknown.length ? [`"${p.tok}" (unit ${p.unit}) uses ${unknown}`] : []), ...lint.map((r) => `"${p.tok}" → ${r}`)];
    });
    expect(problems).toEqual([]);
  });
});

describe('compounds.yaml', () => {
  it('uses only known words', () => {
    const bad = COMPOUNDS.filter((c) => wordsIn(c.tok).some((w) => !DICTIONARY.has(w))).map((c) => c.tok);
    expect(bad).toEqual([]);
  });
});

// ── path engine ──────────────────────────────────────────────────────────────
import { currentUnit, isUnitComplete, markCheckpoint, markLesson, passed, placeThrough, teachableWords, unitStatuses, visibleUnits } from '../src/engine/path';
import { Rating as R, cardId, emptySrs, fromJSON, introduce, review, toJSON } from '../src/engine/srs';
import { wordPool } from '../src/data/words';

describe('path engine', () => {
  const pool = wordPool(WORDS, { includeKu: false, includeSensitive: false });
  const inPool = new Set(pool.map((w) => w.id));
  const units = visibleUnits(UNITS, inPool);
  const now = new Date('2026-02-01T10:00');

  it('hides the optional ku unit unless ku words are in the pool', () => {
    expect(units.some((u) => u.optional)).toBe(false);
    const withKu = new Set(wordPool(WORDS, { includeKu: true, includeSensitive: false }).map((w) => w.id));
    expect(visibleUnits(UNITS, withKu).some((u) => u.optional)).toBe(true);
  });

  it('starts at unit 1 with everything else locked', () => {
    const s = unitStatuses(units, emptySrs(), inPool);
    expect(s.get('u1')).toBe('current');
    expect([...s.values()].filter((v) => v === 'locked')).toHaveLength(units.length - 1);
  });

  it('teaches no new words until the lesson is read, then only the current unit', () => {
    expect(teachableWords(units, emptySrs(), pool)).toEqual([]);
    const s = markLesson(emptySrs(), 'u1');
    expect(teachableWords(units, s, pool).map((w) => w.id)).toEqual(UNITS[0].words);
  });

  it('completes a unit only with the checkpoint passed AND most words learned', () => {
    let s = markLesson(emptySrs(), 'u1');
    s = markCheckpoint(s, 'u1');
    expect(isUnitComplete(UNITS[0], s, inPool)).toBe(false); // words not learned yet
    for (const w of UNITS[0].words) {
      s = introduce(s, w, 'recognise', now);
      s = review(s, cardId(w, 'recognise'), R.Easy, now, 'test');
    }
    expect(isUnitComplete(UNITS[0], s, inPool)).toBe(true);
    expect(currentUnit(units, s, inPool)?.id).toBe('u2');
  });

  it('placement skips units and schedules their words as known', () => {
    const s = placeThrough(emptySrs(), units, 5, now);
    expect(currentUnit(units, s, inPool)?.id).toBe('u6');
    expect(s.cards['soweli:recognise'].state).toBe(2);
    expect(s.introduced).toEqual({}); // doesn't eat today's new-word allowance
    expect(s.cards['seme:recognise']).toBeUndefined();
  });

  it('round-trips path progress through export', () => {
    const s = placeThrough(emptySrs(), units, 3, now);
    expect(fromJSON(toJSON(s)).path).toEqual(s.path);
    // older exports without a path still load
    expect(fromJSON(JSON.stringify({ app: 'nimi-pona', version: 1, cards: {} })).path.placed).toBe(0);
  });

  it('pass mark is two thirds', () => {
    expect(passed(2, 3)).toBe(true);
    expect(passed(1, 3)).toBe(false);
    expect(passed(3, 5)).toBe(false);
    expect(passed(4, 5)).toBe(true);
  });
});
