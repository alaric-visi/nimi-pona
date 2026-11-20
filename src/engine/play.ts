import type { Sentence } from '../data/sentences';
import type { Word } from '../data/words';
import { normaliseTok } from './answers';
import { cardId, dayKey, isLearned, type SrsState } from './srs';

/** Small, stable string hash (FNV-1a) for deterministic daily picks and garden layout. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── daily toki ───────────────────────────────────────────────────────────────

/**
 * One sentence a day, the same all day. Prefers sentences made only of words the
 * learner has met, so the daily read is achievable; falls back to the simplest ones.
 */
export function dailySentence(date: Date, sentences: readonly Sentence[], state: SrsState): Sentence {
  const met = new Set(Object.keys(state.cards).filter((id) => id.endsWith(':recognise')).map((id) => id.split(':')[0]));
  const readable = sentences.filter((s) => s.words.length >= 2 && s.words.every((w) => met.has(w)));
  const pool = readable.length >= 8 ? readable : sentences.filter((s) => s.level === 1 && s.words.length >= 2);
  return pool[hash(dayKey(date)) % pool.length];
}

export interface CalendarDay {
  key: string;
  date: Date;
  practised: boolean;
  today: boolean;
}

/**
 * The last `weeks` weeks, Monday-first, marking days with any practice (reviews or the
 * daily read). Deliberately not a streak: gaps are fine, the picture is what matters.
 */
export function practiceCalendar(state: SrsState, now: Date, weeks = 4): CalendarDay[] {
  const days = new Set(state.extras.daily);
  for (const e of state.log) days.add(dayKey(new Date(e.t)));
  const todayKey = dayKey(now);
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  const sinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - sinceMonday - (weeks - 1) * 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKey(d);
    return { key, date: d, practised: days.has(key), today: key === todayKey };
  });
}

export function markDaily(state: SrsState, now: Date): SrsState {
  const key = dayKey(now);
  if (state.extras.daily.includes(key)) return state;
  return { ...state, extras: { ...state.extras, daily: [...state.extras.daily, key] } };
}

// ── mastery garden ───────────────────────────────────────────────────────────

export interface Plant {
  word: string;
  /** 0–100 across the bed */
  x: number;
  /** 0–1: back row to front row */
  depth: number;
  /** 0–1 growth from memory stability */
  growth: number;
  /** long-term memory: the plant flowers */
  flowering: boolean;
  /** leaf pairs */
  leaves: number;
  lean: number;
}

/**
 * One plant per learned word. Position is seeded by the word (it never moves);
 * height follows FSRS stability on a log scale, and words held for a month flower.
 */
export function garden(state: SrsState, words: readonly Word[]): Plant[] {
  const plants: Plant[] = [];
  for (const w of words) {
    const card = state.cards[cardId(w.id, 'recognise')];
    if (!isLearned(card)) continue;
    const h = hash(w.id);
    const growth = Math.min(1, Math.log2(1 + card!.stability) / Math.log2(1 + 120));
    plants.push({
      word: w.id,
      x: 4 + ((h % 1000) / 1000) * 92,
      depth: ((h >>> 10) % 100) / 100,
      growth,
      flowering: card!.stability >= 30,
      leaves: 1 + Math.floor(growth * 3),
      lean: (((h >>> 17) % 100) / 100 - 0.5) * 8,
    });
  }
  // back rows first so front plants overlap them
  return plants.sort((a, b) => a.depth - b.depth);
}

// ── compound puzzles ─────────────────────────────────────────────────────────

export interface Puzzle {
  en: string;
  hint: string;
  accept: string[];
}

export type PuzzleVerdict = 'accepted' | 'other';

export function judgePuzzle(answer: readonly string[], puzzle: Puzzle): PuzzleVerdict {
  const a = normaliseTok(answer.join(' '));
  return puzzle.accept.some((x) => normaliseTok(x) === a) ? 'accepted' : 'other';
}

/** Tiles: every word in the accepted answers, plus a few distractors. */
export function puzzleTiles(puzzle: Puzzle, pool: readonly Word[], rng: () => number, extra = 3): string[] {
  const needed = [...new Set(puzzle.accept.flatMap((a) => a.split(' ')))];
  const others = pool.map((w) => w.id).filter((w) => !needed.includes(w) && w !== 'pi');
  const picks: string[] = [];
  while (picks.length < extra && others.length) picks.push(others.splice(Math.floor(rng() * others.length), 1)[0]);
  const tiles = [...needed, ...picks];
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}
