import { inTopic, type Word } from '../data/words';

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDeck(words: readonly Word[], topic: string, rng: Rng = Math.random): Word[] {
  return shuffle(words.filter((w) => inTopic(w, topic)), rng);
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'and', 'or', 'be', 'is', 'for', 'with', 'by', 'at', 'in', 'on',
  'as', 'etc', 'marker', 'toki', 'pona',
]);

/** Content words across a word's glosses, used to detect overlapping meanings. */
export function glossTokens(w: Word): Set<string> {
  return new Set(
    w.glosses
      .join(' ')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

/** True when two words would make an ambiguous quiz pair (synonyms or shared gloss words). */
export function tooSimilar(a: Word, b: Word): boolean {
  if (a.id === b.id) return true;
  if (a.synonyms?.includes(b.id) || b.synonyms?.includes(a.id)) return true;
  const ta = glossTokens(a);
  for (const t of glossTokens(b)) if (ta.has(t)) return true;
  return false;
}

/**
 * Pick `n` wrong options for `card`. Prefers options that can't be confused with the answer
 * (or with each other); falls back to any other word only if the pool is too small.
 */
export function pickDistractors(card: Word, words: readonly Word[], n = 3, rng: Rng = Math.random): Word[] {
  const picked: Word[] = [];
  for (const w of shuffle(words, rng)) {
    if (picked.length === n) break;
    if (tooSimilar(card, w)) continue;
    if (picked.some((p) => tooSimilar(p, w))) continue;
    picked.push(w);
  }
  if (picked.length < n) {
    for (const w of shuffle(words, rng)) {
      if (picked.length === n) break;
      if (w.id !== card.id && !picked.includes(w)) picked.push(w);
    }
  }
  return picked;
}
