import type { Unit } from '../data/path';
import type { Word } from '../data/words';
import { cardId, introduce, isLearned, review, Rating, type SrsState } from './srs';

/**
 * The learning path. A unit is complete when its checkpoint is passed AND most of its
 * words are learned (their recognition card has graduated to long-term review) —
 * the spaced-repetition engine, not a one-off score, decides when you're ready to move on.
 */

export type UnitStatus = 'complete' | 'current' | 'locked';

/** Share of a unit's words whose recognition must be learned to complete it. */
export const MASTERY_THRESHOLD = 0.8;

export interface UnitMastery {
  learned: number;
  started: number;
  total: number;
}

export function unitMastery(unit: Unit, state: SrsState, inPool: ReadonlySet<string>): UnitMastery {
  const words = unit.words.filter((w) => inPool.has(w));
  let learned = 0;
  let started = 0;
  for (const w of words) {
    const card = state.cards[cardId(w, 'recognise')];
    if (card) started++;
    if (isLearned(card)) learned++;
  }
  return { learned, started, total: words.length };
}

export function isUnitComplete(unit: Unit, state: SrsState, inPool: ReadonlySet<string>): boolean {
  if (unit.n <= state.path.placed) return true;
  if (!state.path.checkpoints.includes(unit.id)) return false;
  const m = unitMastery(unit, state, inPool);
  return m.total === 0 || m.learned / m.total >= MASTERY_THRESHOLD;
}

/** Units visible on the path: optional units only when their words are in the pool. */
export function visibleUnits(units: readonly Unit[], inPool: ReadonlySet<string>): Unit[] {
  return units.filter((u) => !u.optional || u.words.some((w) => inPool.has(w)));
}

/** Status of each unit: complete ones, then exactly one current, then locked. */
export function unitStatuses(units: readonly Unit[], state: SrsState, inPool: ReadonlySet<string>): Map<string, UnitStatus> {
  const result = new Map<string, UnitStatus>();
  let currentFound = false;
  for (const u of units) {
    if (!currentFound && isUnitComplete(u, state, inPool)) result.set(u.id, 'complete');
    else if (!currentFound) {
      result.set(u.id, 'current');
      currentFound = true;
    } else result.set(u.id, 'locked');
  }
  return result;
}

export function currentUnit(units: readonly Unit[], state: SrsState, inPool: ReadonlySet<string>): Unit | null {
  const statuses = unitStatuses(units, state, inPool);
  return units.find((u) => statuses.get(u.id) === 'current') ?? null;
}

/**
 * Which words Learn sessions may introduce: only the current unit's, and only once its
 * mini-lesson has been read. Words keep the unit's authored teaching order.
 */
export function teachableWords(units: readonly Unit[], state: SrsState, pool: readonly Word[]): Word[] {
  const inPool = new Set(pool.map((w) => w.id));
  const unit = currentUnit(units, state, inPool);
  if (!unit || !state.path.lessons.includes(unit.id)) return [];
  const byId = new Map(pool.map((w) => [w.id, w]));
  return unit.words.map((w) => byId.get(w)).filter((w): w is Word => !!w);
}

export function markLesson(state: SrsState, unitId: string): SrsState {
  if (state.path.lessons.includes(unitId)) return state;
  return { ...state, path: { ...state.path, lessons: [...state.path.lessons, unitId] } };
}

export function markCheckpoint(state: SrsState, unitId: string): SrsState {
  if (state.path.checkpoints.includes(unitId)) return state;
  return { ...state, path: { ...state.path, checkpoints: [...state.path.checkpoints, unitId] } };
}

/** Fraction of checkpoint questions needed to pass. */
export const PASS_MARK = 2 / 3;
export const passed = (correct: number, total: number) => total > 0 && correct / total >= PASS_MARK - 1e-9;

/**
 * Placement: skip units 1..n. Their words are entered as already known (an "Easy"
 * first review), so they're scheduled for spaced review rather than taught again.
 */
export function placeThrough(state: SrsState, units: readonly Unit[], n: number, now: Date): SrsState {
  let next = state;
  for (const u of units) {
    if (u.n > n || u.optional) continue;
    for (const w of u.words) {
      const id = cardId(w, 'recognise');
      if (next.cards[id]) continue;
      next = introduce(next, w, 'recognise', now);
      next = review(next, id, Rating.Easy, now, 'placement');
    }
    next = markLesson(markCheckpoint(next, u.id), u.id);
  }
  // placement words don't use up today's new-word allowance
  return { ...next, introduced: state.introduced, path: { ...next.path, placed: Math.max(next.path.placed, n) } };
}
