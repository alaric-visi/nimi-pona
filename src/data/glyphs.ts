import data from './glyphs.json';
import { tokenize } from '../lang/tokenize';

/** sitelen pona glyph outlines (from nasin nanpa, MIT), as SVG path data in a 100-unit em. */
export interface GlyphData {
  d: string;
  /** tight ink box: [x, y, width, height] */
  box: [number, number, number, number];
}

const GLYPHS = data.glyphs as unknown as Record<string, GlyphData>;

export const glyphFor = (key: string): GlyphData | undefined => GLYPHS[key];
export const glyphKeys = (): string[] => Object.keys(GLYPHS);

/**
 * Shared frame for every glyph so they keep their designed relative size:
 * full em width, and the vertical extent of all ink.
 */
export const GLYPH_FRAME = (() => {
  let top = Infinity;
  let bottom = -Infinity;
  for (const g of Object.values(GLYPHS)) {
    top = Math.min(top, g.box[1]);
    bottom = Math.max(bottom, g.box[1] + g.box[3]);
  }
  return { x: 0, y: Math.floor(top), w: data.em, h: Math.ceil(bottom - top) };
})();

/**
 * Letters → the glyph used for that sound inside a name cartouche.
 * sitelen pona spells names acrophonically: each glyph stands for its word's first letter.
 */
export const CARTOUCHE_LETTERS: Record<string, string> = {
  a: 'alasa', e: 'esun', i: 'ilo', o: 'olin', u: 'uta',
  j: 'jan', k: 'kasi', l: 'lipu', m: 'mun', n: 'nena', p: 'pipi', s: 'suno', t: 'telo', w: 'waso',
};

/** Glyph keys spelling a (Toki Pona-shaped) name, letter by letter. Unknown letters are skipped. */
export function cartoucheFor(name: string): string[] {
  return [...name.toLowerCase()].map((c) => CARTOUCHE_LETTERS[c]).filter((k): k is string => !!k);
}

export type SitelenPart =
  | { kind: 'glyph'; key: string; word: string }
  | { kind: 'name'; name: string; keys: string[] }
  | { kind: 'break' };

/** Lay out a Toki Pona sentence as sitelen pona: word glyphs, names in cartouches, breaks at sentence ends. */
export function sitelenParts(text: string): SitelenPart[] {
  const parts: SitelenPart[] = [];
  for (const t of tokenize(text)) {
    if (t.kind === 'word' && GLYPHS[t.text]) parts.push({ kind: 'glyph', key: t.text, word: t.text });
    else if (t.kind === 'name') parts.push({ kind: 'name', name: t.text, keys: cartoucheFor(t.text) });
    else if (t.kind === 'punct' && /[.!?:…]/.test(t.text)) {
      if (parts.length && parts[parts.length - 1].kind !== 'break') parts.push({ kind: 'break' });
    }
  }
  while (parts.length && parts[parts.length - 1].kind === 'break') parts.pop();
  return parts;
}
