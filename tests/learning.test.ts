import { describe, expect, it } from 'vitest';
import { DICTIONARY, WORDS, WORD_BY_ID, wordPool } from '../src/data/words';
import { SENTENCES, examplesFor } from '../src/data/sentences';
import { contentWords, levenshtein, matchWord, translationScore } from '../src/engine/answers';
import { makeMistake, MISTAKE_RULES } from '../src/lang/mistakes';
import { lintSentence } from '../src/lang/grammar';
import { FILL_TARGETS, SPOT_RULES, gradeExercise, makeExercise, type ExerciseContext } from '../src/engine/exercises';
import { answerItem, completeIntro, planSession, runDone, startRun, teachingOrder, DEFAULT_PLAN } from '../src/engine/planner';
import { Rating, SKILLS, cardId, emptySrs, fromJSON, introduce, isLearned, review, toJSON } from '../src/engine/srs';
import { forSpanishVoice } from '../src/app/speech';

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = wordPool(WORDS, { includeKu: false, includeSensitive: false });
const FREQ = new Map(WORDS.map((w) => [w.id, examplesFor(w.id, 999).length]));
const ORDER = teachingOrder(POOL, FREQ);
const ctx = (seed = 1): ExerciseContext => ({
  pool: POOL,
  sentencesFor: (id) => examplesFor(id, 999),
  allSentences: SENTENCES,
  dictionary: DICTIONARY,
  rng: seeded(seed),
});
const W = (id: string) => WORD_BY_ID.get(id)!;
const DAY = 86_400_000;

describe('answers', () => {
  it('levenshtein', () => {
    expect(levenshtein('kijetesantakalu', 'kijetesantakalu')).toBe(0);
    expect(levenshtein('soweli', 'sowli')).toBe(1);
    expect(levenshtein('pan', 'pana')).toBe(1);
  });
  it('forgives one slip on longer words only', () => {
    expect(matchWord(' Soweli ', ['soweli'])).toBe('exact');
    expect(matchWord('sowli', ['soweli'])).toBe('typo');
    expect(matchWord('pana', ['pan'])).toBe('wrong'); // a different real word
    expect(matchWord('ali', ['ale', 'ali'])).toBe('exact');
  });
  it('scores translations by meaning, not word order', () => {
    expect(translationScore('the animal is cute', ['The animal is cute.'])).toBe(1);
    expect(translationScore('cute animals', ['The animal is cute.'])).toBe(1);
    expect(translationScore('the children are playing', ['The child is playing.'])).toBe(1);
    expect(translationScore('the dog', ['The animal is cute.'])).toBe(0);
    expect(translationScore('I like red fruits', ['I like red fruit.'])).toBe(1);
    expect(contentWords("I'm eating.")).toEqual(['eat']);
  });
});

describe('spot the mistake', () => {
  it('every rule can be generated from the corpus, and the linter flags it', () => {
    for (const rule of MISTAKE_RULES) {
      const made = SENTENCES.map((s) => makeMistake(s.tok, rule, DICTIONARY)).filter(Boolean);
      expect(made.length, rule).toBeGreaterThan(0);
      for (const m of made) {
        expect(lintSentence(m!.tokens.join(' '), DICTIONARY).map((i) => i.rule)).toContain(rule);
      }
    }
  });
  it('builds the expected errors', () => {
    expect(makeMistake('mi pona.', 'li-after-bare-subject', DICTIONARY)!.tokens.join(' ')).toBe('mi li pona');
    expect(makeMistake('mi sona ala e ni.', 'ala-placement', DICTIONARY)!.tokens.join(' ')).toBe('mi ala sona e ni');
    expect(makeMistake('mi moku e kili e pan.', 'en-joins-predicate', DICTIONARY)!.tokens.join(' ')).toBe(
      'mi moku e kili en pan',
    );
  });
});

describe('exercises', () => {
  it('can produce an exercise for every word × skill at every stage', () => {
    for (const w of POOL) {
      for (const skill of SKILLS) {
        for (const reps of [0, 1, 3, 8]) {
          const card = { reps } as never;
          const ex = makeExercise(w, skill, false, card, ctx(reps + w.id.length));
          expect(ex.word.id).toBe(w.id);
          if ('options' in ex && ex.type !== 'fill') {
            expect(ex.options.map((o) => o.id)).toContain(w.id);
            expect(new Set(ex.options.map((o) => o.id)).size).toBe(ex.options.length);
          }
        }
      }
    }
  });

  it('fill-in never offers two particles that both fit', () => {
    for (const id of FILL_TARGETS) {
      for (let seed = 0; seed < 20; seed++) {
        const ex = makeExercise(W(id), 'recall', false, { reps: 5 } as never, ctx(seed));
        if (ex.type !== 'fill') continue;
        expect(ex.tokens[ex.blank]).toBe(id);
        expect(ex.options).toContain(id);
        if (id === 'li') expect(ex.options).not.toContain('o');
        if (id === 'en') expect(ex.options).not.toContain('anu');
      }
    }
  });

  it('every spot-the-mistake word can produce its exercise', () => {
    for (const id of Object.keys(SPOT_RULES)) {
      const exs = Array.from({ length: 30 }, (_, s) => makeExercise(W(id), 'recognise', false, { reps: 4 } as never, ctx(s)));
      expect(exs.some((e) => e.type === 'spot'), id).toBe(true);
    }
  });

  it('grades responses into FSRS ratings', () => {
    const typed = makeExercise(W('soweli'), 'recall', false, { reps: 5 } as never, ctx(3));
    const t = { type: 'typed', word: W('soweli') } as const;
    expect(gradeExercise(t, { kind: 'text', value: 'soweli' }).rating).toBe(Rating.Good);
    expect(gradeExercise(t, { kind: 'text', value: 'sowli' }).rating).toBe(Rating.Hard);
    expect(gradeExercise(t, { kind: 'text', value: 'waso' }).rating).toBe(Rating.Again);
    expect(typed.word.id).toBe('soweli');
    const tr = { type: 'translate', word: W('soweli'), sentence: SENTENCES.find((s) => s.tok === 'soweli li suwi.')! } as const;
    expect(gradeExercise(tr, { kind: 'text', value: 'the animal is cute' }).correct).toBe(true);
    expect(gradeExercise(tr, { kind: 'text', value: 'banana' }).correct).toBe(false);
    expect(gradeExercise(tr, { kind: 'override' }).rating).toBe(Rating.Good);
  });
});

describe('srs + planner', () => {
  it('teaches the most useful words first', () => {
    expect(ORDER.slice(0, 6).map((w) => w.id)).toEqual(expect.arrayContaining(['li', 'mi']));
    expect(ORDER.findIndex((w) => w.id === 'kijetesantakalu')).toBe(-1); // ku is off in this pool
  });

  it('a first session introduces new words, interleaved', () => {
    const plan = planSession(emptySrs(), ORDER, ORDER, new Date('2026-01-05T09:00'));
    expect(plan.counts.newWords).toBe(DEFAULT_PLAN.newPerSession);
    expect(plan.queue.every((q) => q.intro)).toBe(true);
  });

  it('unlocks recall and glyph skills once recognition is learned', () => {
    const now = new Date('2026-01-05T09:00');
    let s = introduce(emptySrs(), 'pona', 'recognise', now);
    s = review(s, cardId('pona', 'recognise'), Rating.Easy, now, 'test');
    expect(isLearned(s.cards[cardId('pona', 'recognise')])).toBe(true);
    const plan = planSession(s, ORDER, ORDER, new Date(now.getTime() + 60_000), { ...DEFAULT_PLAN, newPerSession: 0 });
    expect(plan.queue.map((q) => q.id)).toEqual(expect.arrayContaining(['pona:recall', 'pona:glyph']));
    expect(plan.queue.map((q) => q.id)).not.toContain('pona:listen');
  });

  it('reviews words outside the introducible set (regression: past units kept their reviews)', () => {
    const now = new Date('2026-01-05T09:00');
    let s = introduce(emptySrs(), 'soweli', 'recognise', now);
    s = review(s, cardId('soweli', 'recognise'), Rating.Good, now, 'test');
    const later = new Date(now.getTime() + 30 * 86_400_000);
    // the learner is on a unit that doesn't contain soweli: it must still be reviewed
    const plan = planSession(s, ORDER, ORDER.filter((w) => w.id === 'pona'), later);
    expect(plan.queue.map((q) => q.id)).toContain('soweli:recognise');
    expect(plan.queue.filter((q) => q.intro).map((q) => q.word)).toEqual(['pona']);
  });

  it('respects the daily new-word limit across sessions', () => {
    const now = new Date('2026-01-05T09:00');
    let s = emptySrs();
    for (let i = 0; i < 3; i++) {
      const plan = planSession(s, ORDER, ORDER, now);
      let run = startRun(plan.queue);
      s = plan.state;
      while (!runDone(run)) {
        if (run.queue[0].intro) ({ run, state: s } = completeIntro(run, s, now));
        else ({ run, state: s } = answerItem(run, s, Rating.Good, now, 'test'));
      }
    }
    const introduced = Object.keys(s.cards).filter((id) => id.endsWith(':recognise')).length;
    expect(introduced).toBe(DEFAULT_PLAN.newPerDay);
  });

  it('round-trips progress through JSON export', () => {
    const now = new Date('2026-01-05T09:00');
    let s = introduce(emptySrs(), 'pona', 'recognise', now);
    s = review(s, 'pona:recognise', Rating.Good, now, 'test');
    const back = fromJSON(toJSON(s));
    expect(back.cards['pona:recognise'].due.getTime()).toBe(s.cards['pona:recognise'].due.getTime());
    expect(back.log).toEqual(s.log);
    expect(() => fromJSON('{"hello":1}')).toThrow(/not a nimi pona/);
  });

  /**
   * A week with a simulated learner whose memory is modelled independently of FSRS:
   * recall probability = exp(-elapsed / strength); remembering strengthens the memory,
   * forgetting weakens it. The scheduler should keep recall high on review days
   * and keep the daily workload bounded.
   */
  it('7-day simulated learner keeps retention high with a bounded workload', () => {
    const rng = seeded(42);
    const strength = new Map<string, number>(); // days
    const last = new Map<string, number>(); // ms of last exposure
    let s = emptySrs();
    const daily: { reviews: number; firstTryCorrect: number; firstTries: number }[] = [];

    for (let day = 0; day < 7; day++) {
      const stats = { reviews: 0, firstTryCorrect: 0, firstTries: 0 };
      for (const hour of [9, 19]) {
        const now = new Date(Date.UTC(2026, 0, 5 + day, hour));
        const plan = planSession(s, ORDER, ORDER, now);
        s = plan.state;
        let run = startRun(plan.queue);
        const seenThisSession = new Set<string>();
        let guard = 0;
        while (!runDone(run) && guard++ < 500) {
          const item = run.queue[0];
          if (item.intro) {
            ({ run, state: s } = completeIntro(run, s, now));
            strength.set(item.id, 1);
            last.set(item.id, now.getTime());
            continue;
          }
          const t = now.getTime();
          if (!strength.has(item.id)) {
            // a freshly unlocked skill borrows half the strength of recognition
            strength.set(item.id, Math.max(0.5, (strength.get(cardId(item.word, 'recognise')) ?? 1) / 2));
            last.set(item.id, t - DAY);
          }
          const elapsed = (t - last.get(item.id)!) / DAY;
          const p = Math.exp(-elapsed / strength.get(item.id)!);
          const correct = rng() < p;
          strength.set(item.id, correct ? strength.get(item.id)! * 2.5 : Math.max(0.3, strength.get(item.id)! * 0.5));
          last.set(item.id, t);
          if (!seenThisSession.has(item.id)) {
            seenThisSession.add(item.id);
            stats.firstTries++;
            stats.firstTryCorrect += correct ? 1 : 0;
          }
          stats.reviews++;
          ({ run, state: s } = answerItem(run, s, correct ? Rating.Good : Rating.Again, now, 'sim'));
        }
        expect(guard).toBeLessThan(500);
      }
      daily.push(stats);
    }

    const learned = Object.values(s.cards).filter((c) => c.state === 2).length;
    const introducedWords = Object.keys(s.cards).filter((id) => id.endsWith(':recognise')).length;
    const laterDays = daily.slice(1);
    const accuracy =
      laterDays.reduce((a, d) => a + d.firstTryCorrect, 0) / laterDays.reduce((a, d) => a + d.firstTries, 0);
    const maxDailyReviews = Math.max(...daily.map((d) => d.reviews));

    // Report the run (visible with --reporter=verbose)
    console.info({ introducedWords, learnedCards: learned, accuracy: accuracy.toFixed(3), maxDailyReviews, daily });

    expect(introducedWords).toBe(70); // 10 new words a day for 7 days
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
    expect(maxDailyReviews).toBeLessThanOrEqual(120);
    expect(learned).toBeGreaterThan(70);
  });
});

describe('speech', () => {
  it('respells Toki Pona for a Spanish voice', () => {
    expect(forSpanishVoice('jan')).toBe('yan');
    expect(forSpanishVoice('kalama')).toBe('kálama');
    expect(forSpanishVoice('pona')).toBe('pona'); // 2 syllables: Spanish already stresses the first
    expect(forSpanishVoice('mi jo e kijetesantakalu')).toBe('mi yo e kíyetesantakalu');
  });
});
