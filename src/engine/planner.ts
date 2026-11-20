import type { Word } from '../data/words';
import {
  cardId, introduce, introducedOn, isDue, isLearned, retrievability, review,
  type Grade, type Skill, type SrsState,
} from './srs';

export interface QueueItem {
  id: string;
  word: string;
  skill: Skill;
  /** first meeting with this word: show the introduction card */
  intro: boolean;
}

export interface PlanOptions {
  /** new words per local day */
  newPerDay: number;
  /** new words per session (≤ the daily allowance left) */
  newPerSession: number;
  /** due reviews per session */
  maxReviews: number;
  /** newly unlocked skills added per session */
  maxUnlocks: number;
  glyphs: boolean;
  listening: boolean;
}

export const DEFAULT_PLAN: PlanOptions = {
  newPerDay: 10,
  newPerSession: 5,
  maxReviews: 20,
  maxUnlocks: 6,
  glyphs: true,
  listening: true,
};

/**
 * Teaching order for new words: most frequent in the example corpus first, so learners
 * meet li, e, mi, pona, jan… before rarer words, and can read more sentences sooner.
 * pu words before pu synonyms before ku; alphabetical as the final tie-break.
 */
export function teachingOrder(words: readonly Word[], frequency: ReadonlyMap<string, number>): Word[] {
  const tierRank = { pu: 0, 'pu-synonym': 1, ku: 2 } as const;
  return [...words].sort(
    (a, b) =>
      tierRank[a.tier] - tierRank[b.tier] ||
      (frequency.get(b.id) ?? 0) - (frequency.get(a.id) ?? 0) ||
      a.id.localeCompare(b.id),
  );
}

/** Skills that become available once a word's recognition is learned. */
function unlockable(state: SrsState, word: string, opts: PlanOptions): Skill[] {
  const skills: Skill[] = [];
  if (!isLearned(state.cards[cardId(word, 'recognise')])) return skills;
  skills.push('recall');
  if (opts.glyphs) skills.push('glyph');
  if (opts.listening && isLearned(state.cards[cardId(word, 'recall')])) skills.push('listen');
  return skills.filter((s) => !state.cards[cardId(word, s)]);
}

export interface Plan {
  queue: QueueItem[];
  /** state with newly unlocked skill cards created */
  state: SrsState;
  counts: { reviews: number; unlocks: number; newWords: number };
}

/**
 * Build one short session: due reviews (least-remembered first), newly unlocked
 * skills, and a few new words interleaved so a session never starts with a wall of new material.
 */
/**
 * @param reviewable every word whose cards may be reviewed or unlocked (the learner's whole pool)
 * @param introducible words that may be introduced as NEW, in teaching order (e.g. the current unit)
 */
export function planSession(
  input: SrsState,
  reviewable: readonly Word[],
  introducible: readonly Word[],
  now: Date,
  opts: PlanOptions = DEFAULT_PLAN,
): Plan {
  let state = input;
  const inPool = new Set(reviewable.map((w) => w.id));
  const skillEnabled = (s: Skill) => (s === 'glyph' ? opts.glyphs : s === 'listen' ? opts.listening : true);

  // 1. unlock follow-on skills for words whose recognition is learned
  const unlocks: QueueItem[] = [];
  for (const w of reviewable) {
    if (unlocks.length >= opts.maxUnlocks) break;
    for (const skill of unlockable(state, w.id, opts)) {
      if (unlocks.length >= opts.maxUnlocks) break;
      state = introduce(state, w.id, skill, now);
      unlocks.push({ id: cardId(w.id, skill), word: w.id, skill, intro: false });
    }
  }
  const unlockedIds = new Set(unlocks.map((u) => u.id));

  // 2. due reviews in the current pool, lowest recall probability first
  const due = Object.entries(state.cards)
    .filter(([id, card]) => {
      const [word, skill] = [id.slice(0, id.lastIndexOf(':')), id.slice(id.lastIndexOf(':') + 1) as Skill];
      return inPool.has(word) && skillEnabled(skill) && !unlockedIds.has(id) && isDue(card, now);
    })
    .sort(([, a], [, b]) => retrievability(a, now) - retrievability(b, now))
    .slice(0, opts.maxReviews)
    .map(([id]): QueueItem => {
      const i = id.lastIndexOf(':');
      return { id, word: id.slice(0, i), skill: id.slice(i + 1) as Skill, intro: false };
    });

  // 3. new words, within today's allowance
  const allowance = Math.max(0, Math.min(opts.newPerSession, opts.newPerDay - introducedOn(state, now)));
  const fresh: QueueItem[] = introducible
    .filter((w) => !state.cards[cardId(w.id, 'recognise')])
    .slice(0, allowance)
    .map((w) => ({ id: cardId(w.id, 'recognise'), word: w.id, skill: 'recognise', intro: true }));

  // 4. interleave: two familiar items, then one new
  const counts = { reviews: due.length, unlocks: unlocks.length, newWords: fresh.length };
  const familiar = [...due, ...unlocks];
  const queue: QueueItem[] = [];
  while (familiar.length || fresh.length) {
    queue.push(...familiar.splice(0, 2));
    if (fresh.length) queue.push(fresh.shift()!);
  }

  return { queue, state, counts };
}

// ── session runner ───────────────────────────────────────────────────────────

export interface Run {
  queue: QueueItem[];
  /** items answered (not counting introductions) */
  answered: number;
  correct: number;
  /** times each card has been shown this session (caps learning-step repeats) */
  shown: Record<string, number>;
  newWords: string[];
  total: number;
}

export const startRun = (queue: QueueItem[]): Run => ({
  queue,
  answered: 0,
  correct: 0,
  shown: {},
  newWords: [],
  total: queue.length,
});

/** Cards due again within this window are shown again later in the same session. */
const REPEAT_WINDOW_MS = 15 * 60 * 1000;
const MAX_SHOWINGS = 3;
const REINSERT_GAP = 3;

function reinsert(queue: QueueItem[], item: QueueItem): QueueItem[] {
  const at = Math.min(queue.length, REINSERT_GAP);
  return [...queue.slice(0, at), item, ...queue.slice(at)];
}

/** The learner has seen a new word's introduction: create the card and quiz it a few items later. */
export function completeIntro(run: Run, state: SrsState, now: Date): { run: Run; state: SrsState } {
  const [item, ...rest] = run.queue;
  if (!item?.intro) return { run, state };
  const next = introduce(state, item.word, 'recognise', now);
  const followUp: QueueItem = { ...item, intro: false };
  return {
    state: next,
    run: {
      ...run,
      queue: reinsert(rest, followUp),
      newWords: [...run.newWords, item.word],
      total: run.total + 1,
      shown: { ...run.shown, [item.id]: (run.shown[item.id] ?? 0) + 1 },
    },
  };
}

/** Record an answer for the current item and advance. */
export function answerItem(
  run: Run,
  state: SrsState,
  rating: Grade,
  now: Date,
  exercise: string,
): { run: Run; state: SrsState } {
  const [item, ...rest] = run.queue;
  if (!item || item.intro) return { run, state };
  const next = review(state, item.id, rating, now, exercise);
  const shown = (run.shown[item.id] ?? 0) + 1;
  const card = next.cards[item.id];
  const again = card.due.getTime() - now.getTime() <= REPEAT_WINDOW_MS && shown < MAX_SHOWINGS;
  return {
    state: next,
    run: {
      ...run,
      queue: again ? reinsert(rest, item) : rest,
      answered: run.answered + 1,
      // Hard (e.g. right with a typo) still counts as right
      correct: run.correct + (rating >= 2 ? 1 : 0),
      shown: { ...run.shown, [item.id]: shown },
      total: run.total + (again ? 1 : 0),
    },
  };
}

export const runDone = (run: Run) => run.queue.length === 0;
