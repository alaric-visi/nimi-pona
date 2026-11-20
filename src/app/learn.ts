import { computed, effect, signal } from '@preact/signals';
import { del, get, set } from 'idb-keyval';
import { DICTIONARY, WORD_BY_ID } from '../data/words';
import { SENTENCES, examplesFor } from '../data/sentences';
import { gradeExercise, makeExercise, type Exercise, type ExerciseContext, type Response, type Result } from '../engine/exercises';
import { answerItem, completeIntro, planSession, runDone, startRun, DEFAULT_PLAN, type PlanOptions, type Run } from '../engine/planner';
import { cardId, emptyExtras, emptyPath, emptySrs, fromJSON, introducedOn, isDue, isLearned, parseCardId, toJSON, type SrsState } from '../engine/srs';
import { UNITS, type Unit } from '../data/path';
import {
  currentUnit, markCheckpoint, markLesson, placeThrough, teachableWords, unitMastery, unitStatuses, visibleUnits,
} from '../engine/path';
import { cue, hiddenWords, pool, settings } from './store';
import { speechAvailable, speechReady } from './speech';

/**
 * Learn mode state: spaced-repetition progress (persisted in IndexedDB) and the
 * session in progress. All scheduling logic lives in src/engine; this file wires it to the UI.
 */

const KEY = 'nimi-pona:srs:v1';

export const srs = signal<SrsState>(emptySrs());
export const srsLoaded = signal(false);
export const storageOk = signal(true);
export const voiceReady = signal(false);

void speechReady().then((ok) => (voiceReady.value = ok));

void get<SrsState>(KEY)
  .then((saved) => {
    // older saves (before the learning path) have no `path`
    if (saved?.cards) {
      srs.value = {
        ...emptySrs(),
        ...saved,
        path: { ...emptyPath(), ...saved.path },
        extras: { ...emptyExtras(), ...saved.extras },
      };
    }
  })
  .catch(() => (storageOk.value = false))
  .finally(() => (srsLoaded.value = true));

effect(() => {
  const value = srs.value;
  if (!srsLoaded.value || !storageOk.value) return;
  set(KEY, value).catch(() => (storageOk.value = false));
});

// ── session ──────────────────────────────────────────────────────────────────

export interface Live {
  run: Run;
  exercise: Exercise;
  result: Result | null;
  response: Response | null;
}

export interface Summary {
  answered: number;
  correct: number;
  newWords: string[];
  endedEarly: boolean;
}

export const live = signal<Live | null>(null);
export const summary = signal<Summary | null>(null);

// ── the path ─────────────────────────────────────────────────────────────────

export type LearnScreen =
  | { kind: 'home' }
  | { kind: 'unit'; id: string }
  | { kind: 'checkpoint'; id: string }
  | { kind: 'placement' };

export const screen = signal<LearnScreen>({ kind: 'home' });

const inPool = computed(() => new Set(pool.value.map((w) => w.id)));
export const units = computed(() => visibleUnits(UNITS, inPool.value));
export const statuses = computed(() => unitStatuses(units.value, srs.value, inPool.value));
export const current = computed(() => currentUnit(units.value, srs.value, inPool.value));
export const masteryOf = (u: Unit) => unitMastery(u, srs.value, inPool.value);

/** New words for sessions: the current unit's, once its lesson is read. */
const ordered = computed(() => teachableWords(units.value, srs.value, pool.value));

export const planOptions = computed<PlanOptions>(() => ({
  ...DEFAULT_PLAN,
  newPerDay: settings.value.newPerDay,
  glyphs: settings.value.script !== 'latin',
  listening: settings.value.listening && voiceReady.value,
}));

function context(): ExerciseContext {
  const hidden = hiddenWords.value;
  return {
    pool: pool.value,
    sentencesFor: (id) => examplesFor(id, 999, { excludeWords: hidden }),
    allSentences: SENTENCES.filter((s) => s.words.every((w) => !hidden.has(w))),
    dictionary: DICTIONARY,
    rng: Math.random,
  };
}

function exerciseFor(run: Run): Exercise | null {
  const item = run.queue[0];
  if (!item) return null;
  const word = WORD_BY_ID.get(item.word)!;
  return makeExercise(word, item.skill, item.intro, srs.value.cards[item.id], context());
}

/** Overview for the Learn home screen. */
export const overview = computed(() => {
  const now = new Date();
  const inPool = new Set(pool.value.map((w) => w.id));
  const opts = planOptions.value;
  let due = 0;
  let nextDue: Date | null = null;
  let learnedWords = 0;
  let startedWords = 0;
  for (const [id, card] of Object.entries(srs.value.cards)) {
    const { word, skill } = parseCardId(id);
    if (!inPool.has(word)) continue;
    if (skill === 'glyph' && !opts.glyphs) continue;
    if (skill === 'listen' && !opts.listening) continue;
    if (skill === 'recognise') {
      startedWords++;
      if (isLearned(card)) learnedWords++;
    }
    if (isDue(card, now)) due++;
    else if (!nextDue || card.due < nextDue) nextDue = card.due;
  }
  const unseen = ordered.value.filter((w) => !srs.value.cards[cardId(w.id, 'recognise')]).length;
  const newToday = Math.max(0, Math.min(unseen, opts.newPerDay - introducedOn(srs.value, now)));
  const unit = current.value;
  const lessonNeeded = !!unit && !srs.value.path.lessons.includes(unit.id);
  return { due, newToday, learnedWords, startedWords, total: pool.value.length, nextDue, unit, lessonNeeded };
});

export const learnActions = {
  start() {
    screen.value = { kind: 'home' };
    const now = new Date();
    // review anything in the pool; introduce only the current unit's words
    const plan = planSession(srs.value, pool.value, ordered.value, now, planOptions.value);
    srs.value = plan.state;
    summary.value = null;
    const run = startRun(plan.queue);
    const exercise = exerciseFor(run);
    live.value = exercise ? { run, exercise, result: null, response: null } : null;
  },

  respond(response: Response) {
    const l = live.value;
    if (!l || l.result) return;
    const result = gradeExercise(l.exercise, response);
    live.value = { ...l, result, response };
    if (settings.value.sound) cue(result.correct ? 'correct' : 'wrong');
    // self-graded cards need no feedback panel
    if (response.kind === 'self') learnActions.next();
  },

  /** "I was right": accept a translation the keyword check marked wrong. */
  override() {
    const l = live.value;
    if (!l?.result || l.result.correct || l.exercise.type !== 'translate') return;
    live.value = { ...l, result: gradeExercise(l.exercise, { kind: 'override' }) };
  },

  next() {
    const l = live.value;
    if (!l) return;
    const now = new Date();
    let step: { run: Run; state: SrsState };
    if (l.exercise.type === 'intro') step = completeIntro(l.run, srs.value, now);
    else if (l.result) step = answerItem(l.run, srs.value, l.result.rating, now, l.exercise.type);
    else return;
    srs.value = step.state;
    if (runDone(step.run)) return finish(step.run, false);
    live.value = { run: step.run, exercise: exerciseFor(step.run)!, result: null, response: null };
  },

  quit() {
    const l = live.value;
    if (l) finish(l.run, true);
  },

  closeSummary() {
    summary.value = null;
  },

  open(next: LearnScreen) {
    screen.value = next;
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  },

  /** Lesson read: its words become available, and practice starts straight away. */
  finishLesson(unitId: string) {
    srs.value = markLesson(srs.value, unitId);
    screen.value = { kind: 'home' };
    learnActions.start();
  },

  passCheckpoint(unitId: string) {
    srs.value = markCheckpoint(srs.value, unitId);
  },

  /** Placement result: skip units 1..n. */
  place(n: number) {
    if (n > 0) srs.value = placeThrough(srs.value, units.value, n, new Date());
    screen.value = { kind: 'home' };
  },

  exportProgress(): Blob {
    return new Blob([toJSON(srs.value)], { type: 'application/json' });
  },

  importProgress(json: string) {
    srs.value = fromJSON(json); // throws a readable error on a bad file
    live.value = null;
    summary.value = null;
  },

  async resetProgress() {
    srs.value = emptySrs();
    live.value = null;
    summary.value = null;
    await del(KEY).catch(() => undefined);
  },
};

function finish(run: Run, endedEarly: boolean) {
  live.value = null;
  summary.value = { answered: run.answered, correct: run.correct, newWords: run.newWords, endedEarly };
  if (settings.value.sound && !endedEarly) cue('complete');
}

export const voiceAvailable = () => voiceReady.value && speechAvailable();
