import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/data/words';
import { CARTOUCHE_LETTERS, GLYPH_FRAME, cartoucheFor, glyphFor, sitelenParts } from '../src/data/glyphs';

describe('glyph data', () => {
  it('has a glyph for every word', () => {
    const missing = WORDS.filter((w) => !glyphFor(w.glyph)).map((w) => w.id);
    expect(missing).toEqual([]);
  });

  it('every glyph has path data and a sane ink box inside the shared frame', () => {
    for (const w of WORDS) {
      const g = glyphFor(w.glyph)!;
      expect(g.d.length, w.id).toBeGreaterThan(20);
      const [x, y, width, height] = g.box;
      expect(width, w.id).toBeGreaterThan(0);
      expect(height, w.id).toBeGreaterThan(0);
      expect(x, w.id).toBeGreaterThanOrEqual(0);
      expect(y, w.id).toBeGreaterThanOrEqual(GLYPH_FRAME.y);
      expect(y + height, w.id).toBeLessThanOrEqual(GLYPH_FRAME.y + GLYPH_FRAME.h);
    }
  });
});

describe('cartouches', () => {
  it('maps every Toki Pona letter to a word that starts with it', () => {
    expect(Object.keys(CARTOUCHE_LETTERS).sort().join('')).toBe('aeijklmnopstuw');
    for (const [letter, word] of Object.entries(CARTOUCHE_LETTERS)) {
      expect(word.startsWith(letter), word).toBe(true);
      expect(glyphFor(word), word).toBeDefined();
    }
  });

  it('spells names letter by letter', () => {
    expect(cartoucheFor('Sonja')).toEqual(['suno', 'olin', 'nena', 'jan', 'alasa']);
  });
});

describe('sitelenParts', () => {
  it('lays out words, names and sentence breaks', () => {
    const parts = sitelenParts('jan Lisa o, toki! mi pona.');
    expect(parts.map((p) => (p.kind === 'glyph' ? p.word : p.kind === 'name' ? `[${p.name}]` : '|'))).toEqual([
      'jan', '[Lisa]', 'o', 'toki', '|', 'mi', 'pona',
    ]);
  });

  it('drops trailing breaks and unknown words', () => {
    expect(sitelenParts('banana.')).toEqual([]);
  });
});
