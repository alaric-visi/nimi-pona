import raw from '../../content/sentences.yaml';
import { conceptsIn, difficulty, type Concept } from '../lang/grammar';
import { wordsIn } from '../lang/tokenize';

export interface Sentence {
  tok: string;
  en: string;
  alt: string[];
  /** dictionary words used (derived) */
  words: string[];
  /** grammar concepts exercised (derived) */
  concepts: Concept[];
  /** 1–3 (derived) */
  level: 1 | 2 | 3;
}

export function parseSentences(data: unknown): Sentence[] {
  if (!Array.isArray(data)) throw new Error('sentences.yaml must be a list');
  return data.map((d, i) => {
    const s = d as Record<string, unknown>;
    if (typeof s.tok !== 'string' || !s.tok) throw new Error(`sentences.yaml[${i}]: missing "tok"`);
    if (typeof s.en !== 'string' || !s.en) throw new Error(`sentences.yaml[${i}] (${s.tok}): missing "en"`);
    const alt = s.alt === undefined ? [] : s.alt;
    if (!Array.isArray(alt) || !alt.every((a) => typeof a === 'string')) {
      throw new Error(`sentences.yaml[${i}] (${s.tok}): "alt" must be a list of strings`);
    }
    return {
      tok: s.tok,
      en: s.en,
      alt,
      words: wordsIn(s.tok),
      concepts: conceptsIn(s.tok),
      level: difficulty(s.tok),
    };
  });
}

export const SENTENCES: Sentence[] = parseSentences(raw);

const byWord = new Map<string, Sentence[]>();
for (const s of SENTENCES) {
  for (const w of s.words) {
    const list = byWord.get(w) ?? [];
    list.push(s);
    byWord.set(w, list);
  }
}
// Shortest (simplest) examples first: the clearest demonstration of a word.
for (const list of byWord.values()) list.sort((a, b) => a.tok.length - b.tok.length);

/** Example sentences that use `wordId`, simplest first. */
export function examplesFor(wordId: string, limit = 2, opts: { excludeWords?: ReadonlySet<string> } = {}): Sentence[] {
  const list = byWord.get(wordId) ?? [];
  const ok = opts.excludeWords ? list.filter((s) => s.words.every((w) => !opts.excludeWords!.has(w))) : list;
  return ok.slice(0, limit);
}
