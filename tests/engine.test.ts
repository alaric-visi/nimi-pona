import { describe, expect, it } from 'vitest';
import { WORDS, parseWords, wordPool } from '../src/data/words';
import { buildDeck, pickDistractors, tooSimilar } from '../src/engine/deck';
import * as S from '../src/engine/session';

/** Deterministic PRNG (mulberry32) so tests are reproducible. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const byId = (id: string) => WORDS.find((w) => w.id === id)!;

describe('words data', () => {
  it('loads pu, pu synonyms and ku words', () => {
    expect(WORDS).toHaveLength(138);
  });

  it('rejects malformed data', () => {
    const ok = { id: 'x', tier: 'pu', roles: ['content'], themes: ['nature'], concept: 'c', glosses: ['g'] };
    expect(parseWords([ok])[0].glyph).toBe('x');
    expect(() => parseWords([{ ...ok, glosses: [] }])).toThrow(/glosses/);
    expect(() => parseWords([{ ...ok, themes: ['nope'] }])).toThrow(/unknown theme/);
    expect(() => parseWords([{ ...ok, tier: 'nope' }])).toThrow(/unknown tier/);
    expect(() => parseWords([{ ...ok, synonyms: ['ghost'] }])).toThrow(/unknown synonym/);
  });

  it('pool excludes ku and sensitive words by default', () => {
    const pool = wordPool(WORDS, { includeKu: false, includeSensitive: false });
    expect(pool.some((w) => w.tier === 'ku')).toBe(false);
    expect(pool.some((w) => w.id === 'unpa')).toBe(false);
    expect(pool).toHaveLength(122);
    expect(wordPool(WORDS, { includeKu: true, includeSensitive: true })).toHaveLength(138);
  });
});

describe('distractors', () => {
  it('never offers a synonym of the answer', () => {
    expect(tooSimilar(byId('lukin'), byId('oko'))).toBe(true);
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const ids = pickDistractors(byId('lukin'), WORDS, 3, rng).map((w) => w.id);
      expect(ids).not.toContain('oko');
      expect(ids).not.toContain('lukin');
    }
  });

  it('finds 3 unambiguous distractors for every word', () => {
    const rng = seeded(2);
    for (const w of WORDS) {
      const d = pickDistractors(w, WORDS, 3, rng);
      expect(d).toHaveLength(3);
      for (const x of d) expect(tooSimilar(w, x), `${w.id} vs ${x.id}`).toBe(false);
    }
  });
});

describe('session', () => {
  it('builds category decks', () => {
    expect(buildDeck(WORDS, 'colours').every((w) => w.themes.includes('colours'))).toBe(true);
    expect(buildDeck(WORDS, 'colours')).toHaveLength(6);
    expect(buildDeck(WORDS, 'all')).toHaveLength(WORDS.length);
  });

  it('flash: cannot grade before flipping (no race)', () => {
    let s = S.newSession(WORDS, 'flash', 'colours', seeded(3));
    expect(S.grade(s, true)).toBe(s);
    s = S.flip(s);
    s = S.grade(s, true);
    expect(s.index).toBe(1);
    expect(s.revealed).toBe(false);
    expect(s.correct).toBe(1);
    expect(s.streak).toBe(1);
  });

  it('flash: score is correct / graded, every card graded', () => {
    let s = S.newSession(WORDS, 'flash', 'colours', seeded(4));
    const n = s.deck.length;
    for (let i = 0; i < n; i++) s = S.grade(S.flip(s), i % 2 === 0);
    expect(S.isDone(s)).toBe(true);
    expect(s.seen).toBe(n);
    expect(S.scorePercent(s)).toBe(Math.round((Math.ceil(n / 2) / n) * 100));
  });

  it('quiz: only the first answer counts and wrong resets streak', () => {
    let s = S.newSession(WORDS, 'quiz', 'all', seeded(5));
    const right = S.current(s)!.id;
    const wrong = s.quiz!.options.find((o) => o.id !== right)!.id;
    s = S.answer(s, wrong);
    expect(S.quizResult(s)).toBe('wrong');
    const again = S.answer(s, right);
    expect(again).toBe(s);
    expect(s.seen).toBe(1);
    expect(s.correct).toBe(0);
    s = S.advance(s);
    expect(s.index).toBe(1);
    expect(s.quiz!.chosen).toBeNull();
    expect(s.quiz!.options.map((o) => o.id)).toContain(S.current(s)!.id);
  });

  it('quiz: does not advance until answered (no forced auto-advance)', () => {
    const s = S.newSession(WORDS, 'quiz', 'all', seeded(6));
    expect(S.advance(s)).toBe(s);
  });

  it('done message has newline-free toki pona and English parts', () => {
    const m = S.doneMessage(95);
    expect(m.tok).toMatch(/wawa/);
    expect(m.en).not.toMatch(/\n/);
  });
});
