import type { Word } from '../data/words';
import type { Sentence } from '../data/sentences';
import { makeMistake, type Mistake, type MistakeRule } from '../lang/mistakes';
import { tokenize } from '../lang/tokenize';
import { pickDistractors, shuffle, type Rng } from './deck';
import { matchWord, sameSequence, translationScore } from './answers';
import { Rating, type Card, type Grade, type Skill } from './srs';

/**
 * Exercise generators (what to show for a queued skill card) and graders
 * (turn a response into an FSRS rating). Pure: everything comes in through `ctx`.
 */

export type Exercise =
  | { type: 'intro'; word: Word }
  | { type: 'flash'; word: Word }
  | { type: 'choice'; word: Word; direction: 'tp-en' | 'en-tp'; options: Word[] }
  | { type: 'typed'; word: Word }
  | { type: 'glyph'; word: Word; direction: 'glyph-word' | 'word-glyph'; options: Word[] }
  | { type: 'listen'; word: Word; mode: 'choice' | 'typed'; options: Word[] }
  | { type: 'fill'; word: Word; sentence: Sentence; tokens: string[]; blank: number; options: string[] }
  | { type: 'build'; word: Word; sentence: Sentence; answer: string[]; tiles: string[] }
  | { type: 'spot'; word: Word; mistake: Mistake; sentence: Sentence }
  | { type: 'translate'; word: Word; sentence: Sentence };

export type ExerciseType = Exercise['type'];

export interface ExerciseContext {
  pool: readonly Word[];
  /** example sentences that use a word, excluding hidden words */
  sentencesFor: (wordId: string) => Sentence[];
  allSentences: readonly Sentence[];
  dictionary: ReadonlySet<string>;
  rng: Rng;
}

/** Particles taught by filling them into a sentence. */
export const FILL_TARGETS = ['li', 'e', 'la', 'pi', 'o', 'en', 'anu'];
const FILL_OPTIONS = ['li', 'e', 'la', 'pi', 'o', 'en', 'anu'];
/** Pairs that are BOTH grammatical in the same slot, so must never be offered together. */
const FILL_CONFLICTS: Record<string, string[]> = { li: ['o'], o: ['li'], en: ['anu'], anu: ['en'] };

/** Grammar words practised by spotting a classic error. */
export const SPOT_RULES: Record<string, MistakeRule> = {
  li: 'li-after-bare-subject',
  pi: 'pi-single-word',
  ala: 'ala-placement',
  en: 'en-joins-predicate',
  e: 'en-joins-predicate',
};

const wordsOf = (s: Sentence) => tokenize(s.tok).filter((t) => t.kind !== 'punct').map((t) => t.text);
const pick = <T>(arr: readonly T[], rng: Rng): T | undefined => arr[Math.floor(rng() * arr.length)];

function makeFill(word: Word, ctx: ExerciseContext): Exercise | null {
  if (!FILL_TARGETS.includes(word.id)) return null;
  const candidates = ctx.sentencesFor(word.id).filter((s) => wordsOf(s).length >= 3);
  const sentence = pick(shuffle(candidates, ctx.rng), ctx.rng);
  if (!sentence) return null;
  const tokens = wordsOf(sentence);
  const spots = tokens.map((t, i) => (t === word.id ? i : -1)).filter((i) => i !== -1);
  const blank = pick(spots, ctx.rng)!;
  const others = shuffle(
    FILL_OPTIONS.filter((o) => o !== word.id && !(FILL_CONFLICTS[word.id] ?? []).includes(o)),
    ctx.rng,
  ).slice(0, 3);
  return { type: 'fill', word, sentence, tokens, blank, options: shuffle([word.id, ...others], ctx.rng) };
}

function makeBuild(word: Word, ctx: ExerciseContext): Exercise | null {
  const candidates = ctx
    .sentencesFor(word.id)
    .filter((s) => s.level <= 2 && wordsOf(s).length >= 3 && wordsOf(s).length <= 7 && !s.tok.includes(':'));
  const sentence = pick(shuffle(candidates, ctx.rng), ctx.rng);
  if (!sentence) return null;
  const answer = wordsOf(sentence);
  let tiles = shuffle(answer, ctx.rng);
  for (let i = 0; i < 5 && sameSequence(tiles, answer); i++) tiles = shuffle(answer, ctx.rng);
  return { type: 'build', word, sentence, answer, tiles };
}

function makeSpot(word: Word, ctx: ExerciseContext): Exercise | null {
  const rule = SPOT_RULES[word.id];
  if (!rule) return null;
  for (const sentence of shuffle(ctx.allSentences, ctx.rng)) {
    if (sentence.words.some((w) => !ctx.dictionary.has(w))) continue;
    const mistake = makeMistake(sentence.tok, rule, ctx.dictionary);
    if (mistake) return { type: 'spot', word, mistake, sentence };
  }
  return null;
}

function makeTranslate(word: Word, ctx: ExerciseContext, reps: number): Exercise | null {
  const maxLevel = reps < 6 ? 2 : 3;
  const candidates = ctx.sentencesFor(word.id).filter((s) => s.level <= maxLevel && wordsOf(s).length >= 3);
  const sentence = pick(shuffle(candidates, ctx.rng), ctx.rng);
  return sentence ? { type: 'translate', word, sentence } : null;
}

const choice = (word: Word, direction: 'tp-en' | 'en-tp', ctx: ExerciseContext): Exercise => ({
  type: 'choice',
  word,
  direction,
  options: shuffle([word, ...pickDistractors(word, ctx.pool, 3, ctx.rng)], ctx.rng),
});

/**
 * Choose an exercise for a queued skill card. Early reviews use recognition-friendly
 * formats (multiple choice); as a card matures, harder formats (typing, building,
 * translating) take over.
 */
export function makeExercise(
  word: Word,
  skill: Skill,
  intro: boolean,
  card: Card | undefined,
  ctx: ExerciseContext,
): Exercise {
  if (intro) return { type: 'intro', word };
  const reps = card?.reps ?? 0;
  const r = ctx.rng();
  const first = <T>(...makers: (() => T | null)[]): T | null => {
    for (const m of makers) {
      const x = m();
      if (x) return x;
    }
    return null;
  };

  switch (skill) {
    case 'recognise': {
      if (reps < 2) return choice(word, 'tp-en', ctx);
      return (
        first(
          () => (r < 0.3 ? makeSpot(word, ctx) : null),
          () => (r < 0.55 && reps >= 3 ? makeTranslate(word, ctx, reps) : null),
          () => (r < 0.8 ? choice(word, 'tp-en', ctx) : null),
        ) ?? { type: 'flash', word }
      );
    }
    case 'recall': {
      if (reps < 2) return choice(word, 'en-tp', ctx);
      return (
        first(
          () => (r < 0.6 ? makeFill(word, ctx) : null),
          () => (r < 0.45 ? makeBuild(word, ctx) : null),
        ) ?? { type: 'typed', word }
      );
    }
    case 'glyph':
      return {
        type: 'glyph',
        word,
        direction: reps % 2 === 0 ? 'glyph-word' : 'word-glyph',
        options: shuffle([word, ...pickDistractors(word, ctx.pool, 3, ctx.rng)], ctx.rng),
      };
    case 'listen':
      return {
        type: 'listen',
        word,
        mode: reps < 2 ? 'choice' : 'typed',
        options: shuffle([word, ...shuffle(ctx.pool.filter((w) => w.id !== word.id), ctx.rng).slice(0, 3)], ctx.rng),
      };
  }
}

// ── grading ──────────────────────────────────────────────────────────────────

export type Response =
  | { kind: 'self'; rating: Grade }
  | { kind: 'option'; id: string }
  | { kind: 'text'; value: string }
  | { kind: 'sequence'; words: string[] }
  | { kind: 'index'; index: number }
  /** "I was right": learner overrides keyword grading of a translation */
  | { kind: 'override' };

export interface Result {
  rating: Grade;
  correct: boolean;
  /** extra message for the feedback panel */
  note?: string;
  /** translation coverage, 0–1 */
  score?: number;
}

const ok = (note?: string): Result => ({ rating: Rating.Good, correct: true, note });
const no = (note?: string): Result => ({ rating: Rating.Again, correct: false, note });

export function gradeExercise(ex: Exercise, res: Response): Result {
  if (res.kind === 'self') return { rating: res.rating, correct: res.rating >= Rating.Hard };
  if (res.kind === 'override') return ok('Counted as correct.');

  switch (ex.type) {
    case 'intro':
    case 'flash':
      return ok();
    case 'choice':
    case 'glyph':
      return res.kind === 'option' && res.id === ex.word.id ? ok() : no();
    case 'typed':
    case 'listen': {
      if (res.kind === 'option') return res.id === ex.word.id ? ok() : no();
      if (res.kind !== 'text') return no();
      const m = matchWord(res.value, [ex.word.id, ...(ex.word.variants ?? [])]);
      if (m === 'exact') return ok();
      if (m === 'typo') return { rating: Rating.Hard, correct: true, note: `Nearly — it's spelled "${ex.word.id}".` };
      return no();
    }
    case 'fill':
      return res.kind === 'option' && res.id === ex.word.id ? ok() : no();
    case 'build':
      return res.kind === 'sequence' && sameSequence(res.words, ex.answer) ? ok() : no();
    case 'spot':
      return res.kind === 'index' && res.index === ex.mistake.wrongIndex ? ok() : no();
    case 'translate': {
      if (res.kind !== 'text') return no();
      const score = translationScore(res.value, [ex.sentence.en, ...ex.sentence.alt]);
      if (score >= 0.75) return { ...ok(), score };
      if (score >= 0.4) return { rating: Rating.Hard, correct: true, score, note: 'Close — compare with the model answer.' };
      return { ...no(), score };
    }
  }
}
