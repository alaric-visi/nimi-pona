/**
 * pu-style ("nasin nanpa pona") additive numbers:
 *   ale 100 · mute 20 · luka 5 · tu 2 · wan 1 · ala 0
 * Written largest first and summed: mute luka tu wan = 20 + 5 + 2 + 1 = 28.
 */

const VALUES: [string, number][] = [
  ['ale', 100],
  ['mute', 20],
  ['luka', 5],
  ['tu', 2],
  ['wan', 1],
];
const VALUE_OF = new Map<string, number>([...VALUES, ['ali', 100]]);

export function toTokiPona(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('whole numbers ≥ 0 only');
  if (n === 0) return 'ala';
  const parts: string[] = [];
  let rest = n;
  for (const [word, value] of VALUES) {
    while (rest >= value) {
      parts.push(word);
      rest -= value;
    }
  }
  return parts.join(' ');
}

/** Parse a pu-style number phrase. Returns null when it's not a valid, well-ordered number. */
export function fromTokiPona(phrase: string): number | null {
  const words = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0] === 'ala') return 0;
  if (!words.length) return null;
  let total = 0;
  let last = Infinity;
  for (const word of words) {
    const v = VALUE_OF.get(word);
    if (v === undefined || v > last) return null; // unknown word or out of order
    total += v;
    last = v;
  }
  return total;
}
