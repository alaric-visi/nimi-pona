import { computed, effect, signal } from '@preact/signals';
import { TOPICS, WORDS, wordPool } from '../data/words';
import * as S from '../engine/session';
import { play, type Cue } from './sound';
import {
  loadLifetime, loadSettings, saveLifetime, saveSettings,
  type Lifetime, type ScriptPref, type Settings, type ThemePref,
} from './persist';

const initial = loadSettings();
if (!(TOPICS as readonly string[]).includes(initial.category)) initial.category = 'all';
if (!['learn', 'play', 'dict', 'flash', 'quiz', 'rev'].includes(initial.mode)) initial.mode = 'learn';
if (!['both', 'glyphs', 'latin'].includes(initial.script)) initial.script = 'both';

export const settings = signal<Settings>(initial);
export const lifetime = signal<Lifetime>(loadLifetime());

/** Words available to games under the current content settings. */
export const pool = computed(() =>
  wordPool(WORDS, { includeKu: settings.value.includeKu, includeSensitive: settings.value.includeSensitive }),
);

/** Words outside the pool: example sentences using them are hidden too. */
export const hiddenWords = computed(() => {
  const inPool = new Set(pool.value.map((w) => w.id));
  return new Set(WORDS.filter((w) => !inPool.has(w.id)).map((w) => w.id));
});

/** Free-practice engine mode (Learn mode runs its own engine; keep a valid deck underneath). */
const practiceMode = (m: Settings['mode']): S.Mode => (m === 'flash' || m === 'quiz' || m === 'rev' ? m : 'flash');
export const isPractice = (m: Settings['mode']): m is S.Mode => m === 'flash' || m === 'quiz' || m === 'rev';

export const session = signal<S.SessionState>(S.newSession(pool.value, practiceMode(initial.mode), initial.category));

/** Short message for screen readers; changes are announced by the live region in <App>. */
export const announcement = signal('');

export const card = computed(() => S.current(session.value));
export const done = computed(() => S.isDone(session.value));

effect(() => saveSettings(settings.value));
effect(() => saveLifetime(lifetime.value));
effect(() => {
  const t = settings.value.theme;
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme;
  else root.dataset.theme = t;
  // keep the browser chrome in step with a manually chosen theme
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (t === 'system') meta.media = meta.dataset.media ?? meta.media;
    else {
      meta.dataset.media ??= meta.media;
      meta.media = meta.dataset.media.includes(t) ? 'all' : 'not all';
    }
  }
});

function recordLifetime(before: S.SessionState, after: S.SessionState) {
  if (after.seen === before.seen) return;
  const l = lifetime.value;
  lifetime.value = {
    seen: l.seen + 1,
    correct: l.correct + (after.correct - before.correct),
    bestStreak: Math.max(l.bestStreak, after.streak),
  };
}

export function cue(c: Cue) {
  if (settings.value.sound) play(c);
}

function restartWith(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch };
  session.value = S.newSession(pool.value, practiceMode(settings.value.mode), settings.value.category);
  announcement.value = '';
}

export const actions = {
  setMode: (mode: Settings['mode']) => restartWith({ mode }),
  setCategory: (category: string) => restartWith({ category }),
  restart: () => restartWith({}),
  setTheme: (theme: ThemePref) => (settings.value = { ...settings.value, theme }),
  setContent: (patch: Pick<Partial<Settings>, 'includeKu' | 'includeSensitive'>) => restartWith(patch),
  setScript: (script: ScriptPref) => (settings.value = { ...settings.value, script }),
  setLearning: (patch: Pick<Partial<Settings>, 'newPerDay' | 'listening'>) =>
    (settings.value = { ...settings.value, ...patch }),
  setSound(sound: boolean) {
    settings.value = { ...settings.value, sound };
    if (sound) play('correct'); // a preview, and unlocks audio inside the user gesture
  },

  flip() {
    const next = S.flip(session.value);
    if (next === session.value) return;
    session.value = next;
    const c = S.current(next)!;
    announcement.value = next.revealed
      ? next.mode === 'rev' ? `Answer: ${c.id}` : `Meaning: ${c.concept}`
      : '';
  },

  grade(got: boolean) {
    const before = session.value;
    const next = S.grade(before, got);
    if (next === before) return;
    recordLifetime(before, next);
    session.value = next;
    announcement.value = got ? 'Marked as known.' : 'Marked as missed.';
    cue(S.isDone(next) ? 'complete' : got ? 'correct' : 'wrong');
  },

  answer(optionId: string) {
    const before = session.value;
    const next = S.answer(before, optionId);
    if (next === before) return;
    recordLifetime(before, next);
    session.value = next;
    const c = S.current(next)!;
    announcement.value = S.quizResult(next) === 'correct' ? 'Correct.' : `Not quite. ${c.id} means ${c.concept}.`;
    cue(S.quizResult(next) === 'correct' ? 'correct' : 'wrong');
  },

  advance() {
    const next = S.advance(session.value);
    if (next === session.value) return;
    session.value = next;
    announcement.value = '';
    if (S.isDone(next)) cue('complete');
  },
};
