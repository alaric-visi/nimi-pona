import { isValidWord } from './phonotactics';

/**
 * Adapt a foreign name to Toki Pona phonotactics (the "nimi sina" game).
 *
 * This works from SPELLING, which is a heuristic: the community adapts names by
 * SOUND (e.g. America → Mewika). Results are valid Toki Pona, offered as options
 * for the learner to choose from, not as the one right answer.
 */

const REWRITES: [RegExp, string][] = [
  [/chr/g, 'kr'],
  [/sch|tch|ch|sh|zh/g, 's'],
  [/ph/g, 'p'],
  [/th/g, 't'],
  [/ck/g, 'k'],
  [/qu/g, 'kw'],
  [/x/g, 'ks'],
  [/c(?=[eiy])/g, 's'],
  [/[cqg]/g, 'k'],
  [/b/g, 'p'],
  [/d/g, 't'],
  [/f/g, 'p'],
  [/v/g, 'w'],
  [/r/g, 'l'],
  [/z/g, 's'],
  [/h/g, ''],
  [/y(?=[aeiou])/g, 'j'],
  [/y/g, 'i'],
  [/oo/g, 'u'],
  [/ee/g, 'i'],
  [/([a-z])\1+/g, '$1'],
];

const VOWEL = /[aeiou]/;
const isVowel = (c: string | undefined) => !!c && VOWEL.test(c);

/** Map letters onto the 14 Toki Pona phonemes and drop vowel clusters. */
function normalise(name: string): string {
  let s = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const [re, to] of REWRITES) s = s.replace(re, to);
  // no vowel-initial syllables after the first: keep the first vowel of a cluster
  s = s.replace(/([aeiou])[aeiou]+/g, '$1');
  return s;
}

type Strategy = 'u' | 'echo' | 'drop';

function epenthetic(consonant: string, prevVowel: string | undefined, strategy: Strategy): string {
  let v = strategy === 'echo' && prevVowel ? prevVowel : 'u';
  if (consonant === 'w' && (v === 'u' || v === 'o')) v = 'a';
  if ((consonant === 't' || consonant === 'j') && v === 'i') v = 'e';
  return v;
}

function syllabify(s: string, strategy: Strategy): string {
  let out = '';
  let lastVowel: string | undefined;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (isVowel(c)) {
      out += c;
      lastVowel = c;
      continue;
    }
    const next = s[i + 1];
    if (isVowel(next)) {
      out += c;
      continue;
    }
    // c is followed by a consonant or the end of the word
    const canBeCoda = c === 'n' && isVowel(out[out.length - 1]) && (next === undefined || !/[nm]/.test(next));
    if (canBeCoda) {
      out += 'n';
      continue;
    }
    if (strategy === 'drop' && out.length > 0) continue;
    out += c + epenthetic(c, lastVowel, strategy);
  }
  return out;
}

function repair(s: string): string {
  return s
    .replace(/^ji/, 'i')
    .replace(/^w[ou]/, (m) => m[1])
    .replace(/ti/g, 'si')
    .replace(/ji/g, 'li')
    .replace(/wo/g, 'lo')
    .replace(/wu/g, 'lu')
    .replace(/n([nm])/g, '$1');
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Two or three distinct valid adaptations, most faithful first. */
export function adaptName(name: string): string[] {
  const base = normalise(name);
  if (!base) return [];
  const results: string[] = [];
  for (const strategy of ['echo', 'u', 'drop'] as Strategy[]) {
    const candidate = repair(syllabify(base, strategy));
    if (candidate && isValidWord(candidate) && !results.includes(candidate)) results.push(candidate);
  }
  return results.map(capitalise);
}
