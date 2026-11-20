import type { Word } from '../data/words';
import { buildDeck, pickDistractors, shuffle, type Rng } from './deck';

export type Mode = 'flash' | 'quiz' | 'rev';

export interface QuizState {
  options: Word[];
  /** id of the option the learner picked; null while unanswered */
  chosen: string | null;
}

export interface SessionState {
  mode: Mode;
  topic: string;
  all: readonly Word[];
  deck: Word[];
  index: number;
  /** flash/rev: back face showing */
  revealed: boolean;
  quiz: QuizState | null;
  correct: number;
  seen: number;
  streak: number;
}

/**
 * Pure session state machine. Every transition returns a new state and ignores
 * calls that are invalid for the current phase (e.g. grading an unflipped card),
 * which is what removes the legacy timing races.
 */
export function newSession(all: readonly Word[], mode: Mode, topic: string, rng: Rng = Math.random): SessionState {
  return prepare(
    { mode, topic, all, deck: buildDeck(all, topic, rng), index: 0, revealed: false, quiz: null, correct: 0, seen: 0, streak: 0 },
    rng,
  );
}

export const current = (s: SessionState): Word | undefined => s.deck[s.index];
export const isDone = (s: SessionState): boolean => s.index >= s.deck.length;
export const scorePercent = (s: SessionState): number => (s.seen ? Math.round((s.correct / s.seen) * 100) : 0);

function prepare(s: SessionState, rng: Rng): SessionState {
  const card = current(s);
  if (s.mode !== 'quiz' || !card) return { ...s, revealed: false, quiz: null };
  const options = shuffle([card, ...pickDistractors(card, s.all, 3, rng)], rng);
  return { ...s, revealed: false, quiz: { options, chosen: null } };
}

function record(s: SessionState, got: boolean): SessionState {
  return {
    ...s,
    seen: s.seen + 1,
    correct: s.correct + (got ? 1 : 0),
    streak: got ? s.streak + 1 : 0,
  };
}

export function flip(s: SessionState): SessionState {
  if (s.mode === 'quiz' || isDone(s)) return s;
  return { ...s, revealed: !s.revealed };
}

/** Self-grade in flash/rev mode. Only valid once the answer is revealed. */
export function grade(s: SessionState, got: boolean, rng: Rng = Math.random): SessionState {
  if (s.mode === 'quiz' || !s.revealed || isDone(s)) return s;
  return prepare({ ...record(s, got), index: s.index + 1 }, rng);
}

/** Pick a quiz option. Only the first pick counts. */
export function answer(s: SessionState, optionId: string): SessionState {
  if (!s.quiz || s.quiz.chosen !== null || isDone(s)) return s;
  const got = optionId === current(s)!.id;
  return { ...record(s, got), quiz: { ...s.quiz, chosen: optionId } };
}

/** Move on after a quiz answer. */
export function advance(s: SessionState, rng: Rng = Math.random): SessionState {
  if (!s.quiz || s.quiz.chosen === null) return s;
  return prepare({ ...s, index: s.index + 1 }, rng);
}

/** The last result, if the current quiz question has been answered. */
export function quizResult(s: SessionState): 'correct' | 'wrong' | null {
  if (!s.quiz?.chosen) return null;
  return s.quiz.chosen === current(s)?.id ? 'correct' : 'wrong';
}

export function doneMessage(pct: number): { tok: string; en: string; glyph: string } {
  if (pct >= 90) return { tok: 'wawa! sina sona e toki pona!', en: 'Excellent — you really know these.', glyph: 'wawa' };
  if (pct >= 70) return { tok: 'pona! sina pali pona!', en: 'Good work. Keep it up.', glyph: 'pona' };
  if (pct >= 50) return { tok: 'o awen!', en: "You're getting there. Keep practising.", glyph: 'awen' };
  return { tok: 'o awen musi!', en: 'Keep playing — it gets easier.', glyph: 'musi' };
}
