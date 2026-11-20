/**
 * Tokenizer for Toki Pona in sitelen Lasina.
 * - lower-case words are dictionary words
 * - Capitalised words are unofficial words (names): jan Sonja, ma Kanata
 * - punctuation is kept because it marks clause boundaries
 */

export type Token =
  | { kind: 'word'; text: string }
  | { kind: 'name'; text: string }
  | { kind: 'punct'; text: string };

const PUNCT = /^[.!?:;,…"“”'‘’()]+$/;

export function tokenize(input: string): Token[] {
  const out: Token[] = [];
  // Split into runs of letters or runs of punctuation; whitespace separates.
  for (const m of input.matchAll(/[A-Za-z]+|\.{2,}|[.!?:;,…"“”'‘’()]/g)) {
    const text = m[0];
    if (PUNCT.test(text) || /^\.+$/.test(text)) out.push({ kind: 'punct', text });
    else if (/^[A-Z]/.test(text)) out.push({ kind: 'name', text });
    else out.push({ kind: 'word', text: text.toLowerCase() });
  }
  return out;
}

/** Characters that end a clause (a new subject may follow). */
export const CLAUSE_END = new Set(['.', '!', '?', ':', ';', '…']);

const isClauseEnd = (t: Token) => t.kind === 'punct' && (CLAUSE_END.has(t.text) || /^\.+$/.test(t.text));

/**
 * Split into clauses. Boundaries: sentence punctuation, and `la` (whose
 * right-hand side is a fresh sentence). The `la` context itself is its own clause.
 * Commas are dropped; they don't change Toki Pona structure.
 */
export function clauses(tokens: Token[]): Token[][] {
  const result: Token[][] = [];
  let cur: Token[] = [];
  const flush = () => {
    if (cur.length) result.push(cur);
    cur = [];
  };
  for (const t of tokens) {
    if (isClauseEnd(t)) {
      flush();
      continue;
    }
    if (t.kind === 'punct') continue;
    cur.push(t);
    if (t.kind === 'word' && t.text === 'la') flush();
  }
  flush();
  return result;
}

/** Distinct dictionary words used in a text (names excluded). */
export function wordsIn(input: string): string[] {
  return [...new Set(tokenize(input).filter((t) => t.kind === 'word').map((t) => t.text))];
}
