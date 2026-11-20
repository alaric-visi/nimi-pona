/** Checking typed answers: Toki Pona words (typo-tolerant) and English translations (keyword-based). */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export const normaliseTok = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

export type WordMatch = 'exact' | 'typo' | 'wrong';

/**
 * A typed Toki Pona word. One slip (insert/delete/swap a letter) is forgiven for words
 * longer than 4 letters — short words differ by one letter from other real words (pan/pana, ko/kon).
 */
export function matchWord(answer: string, accepted: readonly string[]): WordMatch {
  const a = normaliseTok(answer);
  if (!a) return 'wrong';
  if (accepted.some((w) => normaliseTok(w) === a)) return 'exact';
  if (accepted.some((w) => w.length > 4 && levenshtein(normaliseTok(w), a) <= 1)) return 'typo';
  return 'wrong';
}

/** A word sequence, e.g. the sentence builder. Compared without punctuation or case. */
export const sameSequence = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => normaliseTok(x) === normaliseTok(b[i]));

// ── English translations ─────────────────────────────────────────────────────

const STOP = new Set(
  ('a an the is are am be been being was were it its it\'s this that these those to of for in on at by with and or ' +
    'i me my we us our you your he she they them their his her do does did there here have has had will would ' +
    'very really just so some any s m re ll ve d t')
    .split(' '),
);

/** Crude English stemmer: enough to match eat/eats/eating, cute/cuter, child/children. */
function stem(w: string): string {
  const irregular: Record<string, string> = {
    children: 'child', people: 'person', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth',
    ate: 'eat', went: 'go', gone: 'go', saw: 'see', seen: 'see', said: 'say', got: 'get', took: 'take',
    made: 'make', gave: 'give', knew: 'know', came: 'come', broke: 'break', broken: 'break', slept: 'sleep',
    stole: 'steal', drank: 'drink', bought: 'buy', thought: 'think', felt: 'feel', died: 'die', kids: 'child',
    kid: 'child',
  };
  if (irregular[w]) return irregular[w];
  for (const suffix of ['ing', 'ies', 'ed', 'es', 'er', 's', 'ly']) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      const base = w.slice(0, -suffix.length);
      return suffix === 'ies' ? `${base}y` : base;
    }
  }
  return w;
}

export function contentWords(english: string): string[] {
  return english
    .toLowerCase()
    .replace(/[“”"()…,.!?:;]/g, ' ')
    .replace(/'/g, ' ')
    .split(/[\s—-]+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

/**
 * How much of a reference translation's meaning the learner's answer covers (0–1),
 * against the best-matching of the accepted references. Keyword-based by design:
 * Toki Pona allows many translations, so we reward meaning, not word order.
 */
export function translationScore(answer: string, references: readonly string[]): number {
  const got = new Set(contentWords(answer));
  if (!got.size) return 0;
  let best = 0;
  for (const ref of references) {
    const want = [...new Set(contentWords(ref))];
    if (!want.length) continue;
    const hit = want.filter((w) => got.has(w) || [...got].some((g) => g.length > 4 && levenshtein(g, w) <= 1)).length;
    best = Math.max(best, hit / want.length);
  }
  return best;
}
