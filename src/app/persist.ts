import type { Mode } from '../engine/session';

export type ThemePref = 'system' | 'light' | 'dark';
/** How Toki Pona is written on cards: sitelen pona + Latin, glyphs only (reading practice), or Latin only. */
export type ScriptPref = 'both' | 'glyphs' | 'latin';

/** 'learn' is the spaced-repetition course; the others are free practice by topic. */
export type AppMode = 'learn' | 'play' | 'dict' | Mode;

export interface Settings {
  mode: AppMode;
  /** word topic filter ('all' or a theme) */
  category: string;
  theme: ThemePref;
  /** include ku-tier community words in games */
  includeKu: boolean;
  /** include words marked sensitive (unpa) in games */
  includeSensitive: boolean;
  script: ScriptPref;
  /** soft feedback tones */
  sound: boolean;
  /** Learn mode: new words per day */
  newPerDay: number;
  /** Learn mode: listening exercises (needs a speech voice) */
  listening: boolean;
}

export interface Lifetime {
  seen: number;
  correct: number;
  bestStreak: number;
}

const KEY_SETTINGS = 'nimi-pona:settings:v1';
const KEY_LIFETIME = 'nimi-pona:lifetime:v1';

export const DEFAULT_SETTINGS: Settings = {
  mode: 'learn',
  category: 'all',
  theme: 'system',
  includeKu: false,
  includeSensitive: false,
  script: 'both',
  sound: false,
  newPerDay: 10,
  listening: true,
};
export const DEFAULT_LIFETIME: Lifetime = { seen: 0, correct: 0, bestStreak: 0 };

/** localStorage can throw (private mode, blocked storage); the app must work without it. */
function load<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep running in-memory */
  }
}

export const loadSettings = () => load(KEY_SETTINGS, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => save(KEY_SETTINGS, s);
export const loadLifetime = () => load(KEY_LIFETIME, DEFAULT_LIFETIME);
export const saveLifetime = (l: Lifetime) => save(KEY_LIFETIME, l);
