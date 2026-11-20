import { lintSentence, PARTICLES, type LintIssue } from './grammar';
import { tokenize } from './tokenize';

/**
 * "Spot the mistake": take a correct sentence and introduce ONE classic learner error.
 * Every mutation is verified against the grammar linter, so the exercise and the
 * content checks always agree on what counts as a mistake.
 */

export type MistakeRule = LintIssue['rule'];

export interface Mistake {
  /** the sentence's words with the error introduced (punctuation removed) */
  tokens: string[];
  /** index into `tokens` of the word that is wrong */
  wrongIndex: number;
  rule: MistakeRule;
  /** the original, correct sentence */
  correct: string;
}

export const MISTAKE_EXPLANATION: Partial<Record<MistakeRule, string>> = {
  'li-after-bare-subject': 'When the subject is just "mi" or "sina", leave out "li".',
  'pi-single-word': '"pi" needs at least two words after it. With one modifier, just use the word: "jan pona", not "jan pi pona".',
  'ala-placement': '"ala" comes after the word it negates: "mi sona ala", not "mi ala sona".',
  'en-joins-predicate': '"en" only joins subjects. For several objects, repeat "e": "e kili e pan".',
};

type Mutator = (t: string[]) => { tokens: string[]; wrongIndex: number } | null;

const isContent = (w: string | undefined) => !!w && !PARTICLES.has(w) && w !== 'la';

const MUTATORS: Partial<Record<MistakeRule, Mutator>> = {
  // "mi pona" → "mi li pona"
  'li-after-bare-subject': (t) =>
    (t[0] === 'mi' || t[0] === 'sina') && isContent(t[1]) && !t.includes('la')
      ? { tokens: [t[0], 'li', ...t.slice(1)], wrongIndex: 1 }
      : null,

  // "jan pona li …" → "jan pi pona li …"
  'pi-single-word': (t) => {
    for (let i = 0; i + 1 < t.length; i++) {
      const after = t[i + 2];
      if (isContent(t[i]) && isContent(t[i + 1]) && (after === undefined || after === 'li' || after === 'e')) {
        if (['mi', 'sina', 'ona'].includes(t[i]) || t[i + 1] === 'ala') continue;
        return { tokens: [...t.slice(0, i + 1), 'pi', ...t.slice(i + 1)], wrongIndex: i + 1 };
      }
    }
    return null;
  },

  // "mi sona ala e ni" → "mi ala sona e ni"
  'ala-placement': (t) =>
    (t[0] === 'mi' || t[0] === 'sina') && isContent(t[1]) && t[2] === 'ala' && t[3] !== t[1]
      ? { tokens: [t[0], 'ala', t[1], ...t.slice(3)], wrongIndex: 1 }
      : null,

  // "mi moku e kili e pan" → "mi moku e kili en pan"
  'en-joins-predicate': (t) => {
    const first = t.indexOf('e');
    const second = first === -1 ? -1 : t.indexOf('e', first + 1);
    if (second === -1) return null;
    return { tokens: [...t.slice(0, second), 'en', ...t.slice(second + 1)], wrongIndex: second };
  },
};

export const MISTAKE_RULES = Object.keys(MUTATORS) as MistakeRule[];

/** Try to introduce `rule` into `sentence`. Returns null if the sentence has no suitable spot. */
export function makeMistake(sentence: string, rule: MistakeRule, dictionary: ReadonlySet<string>): Mistake | null {
  // single-clause sentences only, so the error is unambiguous
  const all = tokenize(sentence);
  if (all.some((t, i) => t.kind === 'punct' && i < all.length - 1)) return null;
  const words = all.filter((t) => t.kind !== 'punct').map((t) => t.text);
  if (words.some((w) => /^[A-Z]/.test(w))) return null; // keep names out of it
  const result = MUTATORS[rule]?.(words);
  if (!result) return null;
  const issues = lintSentence(result.tokens.join(' '), dictionary);
  if (!issues.some((i) => i.rule === rule)) return null;
  return { ...result, rule, correct: sentence };
}
