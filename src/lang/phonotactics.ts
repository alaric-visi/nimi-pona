/**
 * Toki Pona phonotactics.
 *   14 phonemes: p t k s m n l j w  a e i o u
 *   syllable: (C)V(n) — onset optional only word-initially; the only coda is n
 *   forbidden: ji ti wo wu, and n before n or m
 */

const SYLLABLES = /^(?:[ptksmnljw]?[aeiou]n?)(?:[ptksmnljw][aeiou]n?)*$/;
const FORBIDDEN = /ji|ti|wo|wu|n[nm]/;

/** Words that are valid by convention despite the rules (e.g. the syllabic nasal `n`). */
const EXCEPTIONS = new Set(['n']);

export type PhonoIssue =
  | 'empty'
  | 'bad-letter'
  | 'bad-syllable'
  | 'forbidden-sequence';

export function phonoIssues(word: string): PhonoIssue[] {
  const w = word.toLowerCase();
  if (!w) return ['empty'];
  if (EXCEPTIONS.has(w)) return [];
  const issues: PhonoIssue[] = [];
  if (/[^ptksmnljwaeiou]/.test(w)) issues.push('bad-letter');
  else if (!SYLLABLES.test(w)) issues.push('bad-syllable');
  if (FORBIDDEN.test(w)) issues.push('forbidden-sequence');
  return issues;
}

export const isValidWord = (word: string): boolean => phonoIssues(word).length === 0;
