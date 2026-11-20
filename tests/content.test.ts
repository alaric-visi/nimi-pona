/**
 * Content lint — the gate for content/*.yaml. Run on its own with `npm run lint:content`.
 * Every failure message names the offending word or sentence.
 */
import { describe, expect, it } from 'vitest';
import { DICTIONARY, WORDS } from '../src/data/words';
import { SENTENCES, examplesFor } from '../src/data/sentences';
import { lintSentence } from '../src/lang/grammar';
import { phonoIssues } from '../src/lang/phonotactics';

describe('words.yaml', () => {
  it('has all 120 pu words', () => {
    expect(WORDS.filter((w) => w.tier === 'pu')).toHaveLength(120);
  });

  it('has the three pu synonyms', () => {
    expect(WORDS.filter((w) => w.tier === 'pu-synonym').map((w) => w.id).sort()).toEqual(['kin', 'namako', 'oko']);
  });

  it('every word and variant obeys Toki Pona phonotactics', () => {
    const bad = [...DICTIONARY].filter((w) => phonoIssues(w).length).map((w) => `${w}: ${phonoIssues(w)}`);
    expect(bad).toEqual([]);
  });

  it('synonyms are symmetric', () => {
    const byId = new Map(WORDS.map((w) => [w.id, w]));
    const bad = WORDS.flatMap((w) =>
      (w.synonyms ?? []).filter((s) => !byId.get(s)!.synonyms?.includes(w.id)).map((s) => `${w.id} → ${s}`),
    );
    expect(bad).toEqual([]);
  });

  it('every word has at least two example sentences', () => {
    const thin = WORDS.filter((w) => examplesFor(w.id, 99).length < 2).map((w) => `${w.id} (${examplesFor(w.id, 99).length})`);
    expect(thin).toEqual([]);
  });
});

describe('sentences.yaml', () => {
  it('has a substantial corpus', () => {
    expect(SENTENCES.length).toBeGreaterThanOrEqual(250);
  });

  it('has no duplicate sentences', () => {
    const seen = new Set<string>();
    const dupes = SENTENCES.filter((s) => (seen.has(s.tok) ? true : (seen.add(s.tok), false))).map((s) => s.tok);
    expect(dupes).toEqual([]);
  });

  it('every sentence passes the grammar lint', () => {
    const problems = SENTENCES.flatMap((s) =>
      lintSentence(s.tok, DICTIONARY).map((i) => `${s.tok}  →  ${i.rule}: ${i.message}`),
    );
    expect(problems).toEqual([]);
  });

  it('spans all three difficulty levels', () => {
    const levels = new Set(SENTENCES.map((s) => s.level));
    expect([...levels].sort()).toEqual([1, 2, 3]);
  });
});
