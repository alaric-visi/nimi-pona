import { computed, signal } from '@preact/signals';
import { SENTENCES } from '../data/sentences';
import { glyphFor } from '../data/glyphs';
import { dailySentence, garden, markDaily } from '../engine/play';
import { prepare, type Pt } from '../engine/recognizer';
import { samplePath } from '../engine/pathSample';
import { srs } from './learn';
import { hiddenWords, pool } from './store';

/** Play (musi) section: which game is open, and progress recorded into the shared SRS state. */

export type PlayScreen =
  | { kind: 'hub' }
  | { kind: 'names' }
  | { kind: 'puzzles' }
  | { kind: 'speed' }
  | { kind: 'daily' }
  | { kind: 'trace'; word?: string };

export const playScreen = signal<PlayScreen>({ kind: 'hub' });

export const openPlay = (s: PlayScreen) => {
  playScreen.value = s;
  if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
};

export const plants = computed(() => garden(srs.value, pool.value));

export const today = computed(() => {
  const now = new Date();
  const hidden = hiddenWords.value;
  const sentences = SENTENCES.filter((s) => s.words.every((w) => !hidden.has(w)));
  return dailySentence(now, sentences, srs.value);
});

export const readToday = computed(() => {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return srs.value.extras.daily.includes(key);
});

export const playActions = {
  markDailyRead() {
    srs.value = markDaily(srs.value, new Date());
  },
  recordSpeed(score: number) {
    if (score > srs.value.extras.speedBest) srs.value = { ...srs.value, extras: { ...srs.value.extras, speedBest: score } };
  },
  recordTrace(word: string) {
    const traced = { ...srs.value.extras.traced, [word]: (srs.value.extras.traced[word] ?? 0) + 1 };
    srs.value = { ...srs.value, extras: { ...srs.value.extras, traced } };
  },
  recordPuzzle(en: string) {
    if (srs.value.extras.puzzles.includes(en)) return;
    srs.value = { ...srs.value, extras: { ...srs.value.extras, puzzles: [...srs.value.extras.puzzles, en] } };
  },
};

/** Recogniser templates for every glyph in the pool, built once on first use. */
let templates: { item: string; points: Pt[] }[] | null = null;
let templateKey = '';
export function glyphTemplates() {
  const key = pool.value.map((w) => w.id).join(',');
  if (!templates || key !== templateKey) {
    templates = pool.value.map((w) => ({ item: w.id, points: prepare(samplePath(glyphFor(w.glyph)!.d)) }));
    templateKey = key;
  }
  return templates;
}
