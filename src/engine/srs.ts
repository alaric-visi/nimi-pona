import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';

export { Rating, State };
export type { Card, Grade };

/**
 * Each word is learned as up to four separate skills, each with its own FSRS card:
 *   recognise  toki pona → meaning
 *   recall     meaning → toki pona (production)
 *   glyph      sitelen pona ↔ word
 *   listen     sound → word
 */
export const SKILLS = ['recognise', 'recall', 'glyph', 'listen'] as const;
export type Skill = (typeof SKILLS)[number];

export const cardId = (word: string, skill: Skill) => `${word}:${skill}`;
export function parseCardId(id: string): { word: string; skill: Skill } {
  const i = id.lastIndexOf(':');
  return { word: id.slice(0, i), skill: id.slice(i + 1) as Skill };
}

export interface ReviewEntry {
  /** card id */
  c: string;
  /** rating 1–4 */
  r: Grade;
  /** ISO time of the review */
  t: string;
  /** exercise type that produced it */
  ex: string;
}

/** Progress along the learning path (see engine/path.ts). */
export interface PathProgress {
  /** unit ids whose mini-lesson has been read */
  lessons: string[];
  /** unit ids whose checkpoint has been passed */
  checkpoints: string[];
  /** highest unit number skipped via the placement test (0 = none) */
  placed: number;
}

export const emptyPath = (): PathProgress => ({ lessons: [], checkpoints: [], placed: 0 });

/** Progress in the Play games (Phase 5). */
export interface Extras {
  /** local days (YYYY-MM-DD) on which the daily sentence was read */
  daily: string[];
  /** best speed-round score */
  speedBest: number;
  /** glyphs traced successfully: word → times */
  traced: Record<string, number>;
  /** compound puzzles solved (English prompt) */
  puzzles: string[];
}

export const emptyExtras = (): Extras => ({ daily: [], speedBest: 0, traced: {}, puzzles: [] });

export interface SrsState {
  cards: Record<string, Card>;
  log: ReviewEntry[];
  /** new words introduced per local day, for the daily limit */
  introduced: Record<string, number>;
  path: PathProgress;
  extras: Extras;
}

export const emptySrs = (): SrsState => ({ cards: {}, log: [], introduced: {}, path: emptyPath(), extras: emptyExtras() });

const LOG_LIMIT = 5000;

/** Target 90% recall; fuzz spreads reviews so words learned together don't stay clumped. */
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true, maximum_interval: 365 }));

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Start learning a skill: creates the card (due now). */
export function introduce(state: SrsState, word: string, skill: Skill, now: Date): SrsState {
  const id = cardId(word, skill);
  if (state.cards[id]) return state;
  const introduced = { ...state.introduced };
  if (skill === 'recognise') introduced[dayKey(now)] = (introduced[dayKey(now)] ?? 0) + 1;
  return { ...state, cards: { ...state.cards, [id]: createEmptyCard(now) }, introduced };
}

export function review(state: SrsState, id: string, rating: Grade, now: Date, exercise: string): SrsState {
  const card = state.cards[id] ?? createEmptyCard(now);
  const next = scheduler.next(card, now, rating).card;
  const log = [...state.log, { c: id, r: rating, t: now.toISOString(), ex: exercise }];
  return {
    ...state,
    cards: { ...state.cards, [id]: next },
    log: log.length > LOG_LIMIT ? log.slice(log.length - LOG_LIMIT) : log,
  };
}

export const isDue = (card: Card, now: Date) => card.due.getTime() <= now.getTime();

/** Probability of recall right now (0–1). */
export const retrievability = (card: Card, now: Date): number =>
  card.state === State.New ? 0 : scheduler.get_retrievability(card, now, false);

/** A skill counts as learned once it has graduated out of the short learning steps. */
export const isLearned = (card: Card | undefined) => !!card && card.state === State.Review;

export function introducedOn(state: SrsState, now: Date): number {
  return state.introduced[dayKey(now)] ?? 0;
}

// ── serialisation (JSON export/import; IndexedDB stores Dates natively) ──────

const DATE_FIELDS = ['due', 'last_review'] as const;

export function toJSON(state: SrsState): string {
  return JSON.stringify({ app: 'nimi-pona', version: 1, ...state });
}

export function fromJSON(json: string): SrsState {
  const raw = JSON.parse(json);
  if (raw?.app !== 'nimi-pona' || raw.version !== 1 || typeof raw.cards !== 'object') {
    throw new Error('This file is not a nimi pona progress export.');
  }
  const cards: Record<string, Card> = {};
  for (const [id, c] of Object.entries(raw.cards as Record<string, Record<string, unknown>>)) {
    const card = { ...c } as unknown as Card;
    for (const f of DATE_FIELDS) {
      if (c[f] !== undefined) (card as unknown as Record<string, unknown>)[f] = new Date(c[f] as string);
    }
    if (Number.isNaN(card.due.getTime())) throw new Error(`Bad date in card ${id}`);
    cards[id] = card;
  }
  const path = raw.path && typeof raw.path === 'object' ? { ...emptyPath(), ...raw.path } : emptyPath();
  const extras = raw.extras && typeof raw.extras === 'object' ? { ...emptyExtras(), ...raw.extras } : emptyExtras();
  return { cards, log: Array.isArray(raw.log) ? raw.log : [], introduced: raw.introduced ?? {}, path, extras };
}
