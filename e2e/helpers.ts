import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, type Page } from '@playwright/test';
import { tokenize } from '../src/lang/tokenize';
import { makeMistake, MISTAKE_RULES } from '../src/lang/mistakes';

/**
 * Helpers that let tests answer exercises CORRECTLY the way a learner would —
 * by knowing Toki Pona (the content files) — instead of reading answers from the DOM.
 */

interface WordRow { id: string; concept: string; glyph?: string; variants?: string[] }
interface SentenceRow { tok: string; en: string }
interface UnitRow { id: string; checkpoint: { questions: { q: string; options: string[]; answer: number }[] } }

const load = <T>(file: string): T => parse(readFileSync(new URL(`../content/${file}`, import.meta.url), 'utf8')) as T;

export const WORDS = load<WordRow[]>('words.yaml');
export const SENTENCES = load<SentenceRow[]>('sentences.yaml');
export const UNITS = load<UnitRow[]>('units.yaml');
export const PUZZLES = load<{ en: string; accept: string[] }[]>('puzzles.yaml');
const GLYPHS = JSON.parse(readFileSync(new URL('../src/data/glyphs.json', import.meta.url), 'utf8')).glyphs as Record<string, { d: string }>;

const DICTIONARY = new Set(WORDS.flatMap((w) => [w.id, ...(w.variants ?? [])]));
const byConcept = new Map(WORDS.map((w) => [w.concept, w.id]));
const byGlyphPath = new Map(Object.entries(GLYPHS).map(([k, g]) => [g.d, k]));
export const conceptOf = (id: string) => WORDS.find((w) => w.id === id)!.concept;
const wordsOf = (tok: string) => tokenize(tok).filter((t) => t.kind !== 'punct').map((t) => t.text);

/** Fail on any uncaught page error or console error. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Start from a clean profile with the given settings. */
export async function fresh(page: Page, settings: Record<string, unknown> = {}) {
  // "hear" listening exercises: remember the last text sent to speech synthesis
  await page.addInitScript(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const original = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      (window as unknown as { __spoken: string }).__spoken = u.text;
      original(u);
    };
  });
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      indexedDB.deleteDatabase('keyval-store');
      localStorage.setItem(
        'nimi-pona:settings:v1',
        JSON.stringify({ mode: 'learn', category: 'all', theme: 'light', includeKu: false, includeSensitive: false, script: 'both', sound: false, newPerDay: 10, listening: true, ...s }),
      );
    }
  }, settings);
  await page.goto('/');
  await expect(page.locator('.learn-loading')).toHaveCount(0);
}

/** Import a progress file with mature (due) cards through the real Settings → Import UI. */
export async function importMature(page: Page, words: string[], skills = ['recognise', 'recall', 'glyph'], reps = 6) {
  const now = Date.now();
  const day = 86_400_000;
  const cards: Record<string, unknown> = {};
  for (const w of words) {
    for (const s of skills) {
      cards[`${w}:${s}`] = {
        due: new Date(now - day).toISOString(), stability: 5, difficulty: 5, elapsed_days: 5, scheduled_days: 5,
        learning_steps: 0, reps, lapses: 0, state: 2, last_review: new Date(now - 6 * day).toISOString(),
      };
    }
  }
  const json = JSON.stringify({ app: 'nimi-pona', version: 1, cards, log: [], introduced: {} });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('dialog input[type=file]').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.locator('dialog [role=status]')).toContainText('Progress imported');
  await page.getByRole('button', { name: 'Done' }).click();
}

export type Seen =
  | 'intro' | 'choice-tp-en' | 'choice-en-tp' | 'glyph-word' | 'word-glyph' | 'typed' | 'listen'
  | 'fill' | 'build' | 'spot' | 'translate' | 'flash';

const LABELS: [RegExp, Seen][] = [
  [/^What does this mean\?/, 'choice-tp-en'],
  [/^Which word means this\?/, 'choice-en-tp'],
  [/^Which word is this glyph\?/, 'glyph-word'],
  [/^Which glyph is this word\?/, 'word-glyph'],
  [/^Type the toki pona word/, 'typed'],
  [/^Which word do you hear\?/, 'listen'],
  [/^Fill in the missing word/, 'fill'],
  [/^Build the sentence/, 'build'],
  [/^Tap the word that's wrong/, 'spot'],
  [/^Translate into English/, 'translate'],
  [/^Do you remember this word\?/, 'flash'],
];

/** Identifies the current step: progress counter + prompt. Changes when the app moves on. */
async function step(page: Page): Promise<string> {
  if (!(await page.locator('.learn-session').count())) return 'ended';
  const progress = await page.locator('.learn-session .progress-meta span').first().innerText();
  const prompt = await page.locator('.learn-session .card-static').first().innerText().catch(() => '');
  return `${progress}|${prompt}`;
}

/** Wait until the session has moved past `before` (or ended). */
async function moved(page: Page, before: string) {
  await expect.poll(() => step(page), { timeout: 5000 }).not.toBe(before);
}

/** Answer the current Learn exercise correctly, using the keyboard where the app supports it. */
export async function answerCorrectly(page: Page): Promise<Seen> {
  const before = await step(page);
  const kind = await answerOnce(page);
  await moved(page, before);
  return kind;
}

/** Forget what was last spoken, so a listening exercise only ever reads its own audio. */
const clearSpoken = (page: Page) => page.evaluate(() => ((window as unknown as { __spoken: string }).__spoken = ''));

async function answerOnce(page: Page): Promise<Seen> {
  if (await page.locator('.learn-intro').count()) {
    await clearSpoken(page);
    await page.keyboard.press('Enter');
    return 'intro';
  }
  const label = (await page.locator('.learn-prompt .card-label').first().textContent()) ?? '';
  const kind = LABELS.find(([re]) => re.test(label))?.[1];
  if (!kind) throw new Error(`Unknown exercise: "${label}"`);
  const prompt = page.locator('.learn-prompt');
  const option = async (match: (el: import('@playwright/test').Locator) => Promise<boolean>) => {
    const opts = page.locator('.option');
    const n = await opts.count();
    for (let i = 0; i < n; i++) {
      if (await match(opts.nth(i))) {
        await page.keyboard.press(String(i + 1));
        return;
      }
    }
    throw new Error(`No correct option found for ${kind}`);
  };

  switch (kind) {
    case 'choice-tp-en': {
      const word = (await prompt.locator('[lang=tok]').first().textContent())!.trim();
      await option(async (o) => (await o.locator('.option-text').textContent()) === conceptOf(word));
      break;
    }
    case 'choice-en-tp': {
      const id = byConcept.get((await prompt.locator('.card-gloss').textContent())!.trim())!;
      await option(async (o) => (await o.locator('[lang=tok]').textContent()) === id);
      break;
    }
    case 'glyph-word': {
      const id = byGlyphPath.get((await prompt.locator('svg path').getAttribute('d'))!)!;
      await option(async (o) => (await o.locator('.option-text').textContent()) === id);
      break;
    }
    case 'word-glyph': {
      const id = (await prompt.locator('.card-word').textContent())!.trim();
      await option(async (o) => (await o.locator('svg path').getAttribute('d')) === GLYPHS[id].d);
      break;
    }
    case 'typed': {
      const id = byConcept.get((await prompt.locator('.card-gloss').textContent())!.trim())!;
      await page.locator('input.typed-input').fill(id);
      await page.keyboard.press('Enter');
      break;
    }
    case 'fill': {
      const en = (await prompt.locator('.sentence-en').textContent())!.trim();
      const s = SENTENCES.find((x) => x.en === en)!;
      const spans = prompt.locator('.sentence-line > span');
      const n = await spans.count();
      let blank = -1;
      for (let i = 0; i < n; i++) if ((await spans.nth(i).getAttribute('class'))?.includes('blank')) blank = i;
      const answer = wordsOf(s.tok)[blank];
      await option(async (o) => (await o.locator('.option-text').textContent()) === answer);
      break;
    }
    case 'build': {
      const en = (await prompt.locator('.card-gloss').textContent())!.trim();
      for (const w of wordsOf(SENTENCES.find((x) => x.en === en)!.tok)) {
        await page.locator('.tile-bank .tile', { hasText: new RegExp(`^\\d?${w}$`) }).first().click();
      }
      await page.getByRole('button', { name: /^Check/ }).click();
      break;
    }
    case 'spot': {
      const shown = (await prompt.locator('.spot-word').allTextContents()).map((t) => t.replace(/\d+$/, ''));
      let index = -1;
      for (const s of SENTENCES) {
        for (const rule of MISTAKE_RULES) {
          const m = makeMistake(s.tok, rule, DICTIONARY);
          if (m && m.tokens.join(' ') === shown.join(' ')) index = m.wrongIndex;
        }
      }
      await page.keyboard.press(String(index + 1));
      break;
    }
    case 'translate': {
      const tok = (await prompt.locator('.sentence-line').textContent())!.trim();
      await page.locator('textarea').fill(SENTENCES.find((x) => x.tok === tok)!.en);
      await page.keyboard.press('Enter');
      break;
    }
    case 'flash':
      await page.keyboard.press('Space');
      await clearSpoken(page);
      await page.keyboard.press('3');
      return kind;
    case 'listen': {
      // undo the Spanish respelling (accents, y for j) to recover the Toki Pona word
      await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken?: string }).__spoken)).toBeTruthy();
      const spoken = (await page.evaluate(() => (window as unknown as { __spoken: string }).__spoken))
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/y/g, 'j');
      if (await page.locator('.option').count()) {
        await option(async (o) => (await o.locator('[lang=tok]').textContent()) === spoken);
      } else {
        await page.locator('input.typed-input').fill(spoken);
        await page.keyboard.press('Enter');
      }
      break;
    }
  }
  const feedback = page.locator('.feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback.locator('.feedback-title')).toHaveText('pona!');
  await clearSpoken(page);
  await page.keyboard.press('Enter');
  return kind;
}

/** For a multiple-choice prompt (either direction): index of the right option. */
export async function correctChoiceIndex(page: Page): Promise<number> {
  const prompt = page.locator('.learn-prompt');
  const label = await prompt.locator('.card-label').first().textContent();
  const texts = await page.locator('.option .option-text').allTextContents();
  if (label === 'What does this mean?') {
    const word = (await prompt.locator('[lang=tok]').first().textContent())!.trim();
    return texts.indexOf(conceptOf(word));
  }
  if (label === 'Which word means this?') {
    const id = byConcept.get((await prompt.locator('.card-gloss').textContent())!.trim())!;
    return texts.findIndex((t) => t.trim() === id);
  }
  return -1;
}

/** Answer exercises until the session ends; returns the kinds seen. */
export async function finishSession(page: Page, max = 120): Promise<Seen[]> {
  const seen: Seen[] = [];
  for (let i = 0; i < max && (await page.locator('.learn-session').count()); i++) {
    seen.push(await answerCorrectly(page));
  }
  await expect(page.locator('.learn-session')).toHaveCount(0);
  return seen;
}

/** The right option text for a checkpoint question. */
export function checkpointAnswer(unitId: string, question: string): string {
  const q = UNITS.find((u) => u.id === unitId)!.checkpoint.questions.find((x) => x.q === question)!;
  return q.options[q.answer];
}
