import { expect, test } from '@playwright/test';
import { answerCorrectly, checkpointAnswer, conceptOf, correctChoiceIndex, WORDS, finishSession, fresh, importMature, watchErrors, type Seen } from './helpers';

test.describe('Learn: unit 1 from scratch', () => {
  test('lesson → practice session → checkpoint → progress survives reload', async ({ page }) => {
    const errors = watchErrors(page);
    await fresh(page);

    // Home points at unit 1's lesson
    await expect(page.locator('.learn-title')).toHaveText('Next: unit 1');
    await page.keyboard.press('Enter');
    await expect(page.locator('#unit-title')).toContainText('toki!');
    await expect(page.locator('.lesson-examples li')).toHaveCount(3);

    // Read the lesson and start practising: five new words, all answered correctly
    await page.getByRole('button', { name: 'Start practising these words' }).click();
    const seen = await finishSession(page);
    expect(seen.filter((s) => s === 'intro')).toHaveLength(5);
    await expect(page.locator('.summary-title')).toHaveText('Session complete');
    await expect(page.locator('.summary-line')).toContainText('new: mi, sina, pona, ike, toki');

    // Checkpoint: read the dialogue (names in cartouches), answer the questions
    await page.locator('.stop.is-current .stop-btn').click();
    await page.getByRole('button', { name: /^Checkpoint/ }).click();
    await expect(page.locator('.story .cartouche').first()).toBeVisible();
    await page.getByRole('button', { name: 'Show translations' }).click();
    await expect(page.locator('.story-en').first()).toHaveText('Hello!');
    await page.getByRole('button', { name: /^Answer \d questions/ }).click();
    for (let i = 0; i < 3; i++) {
      const q = (await page.locator('.learn-prompt .card-gloss').textContent())!;
      await page.locator('.option', { hasText: checkpointAnswer('u1', q) }).click();
      await expect(page.locator('.feedback-title')).toHaveText('pona!');
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('.done-label')).toHaveText('Checkpoint passed');
    await expect(page.locator('.done-msg')).toContainText('Keep practising');

    // Everything persists (IndexedDB) across a reload
    await page.reload();
    await expect(page.locator('.learn-stats')).toContainText('New today');
    await page.locator('.stop.is-current .stop-btn').click();
    await expect(page.getByRole('button', { name: 'Read the story again' })).toBeVisible();
    // the five words met are started or already learned
    await expect(page.locator('.word-tile.is-started, .word-tile.is-learned')).toHaveCount(5);

    expect(errors).toEqual([]);
  });
});

test.describe('Learn: every exercise type', () => {
  test('mature cards produce all exercise types, each answerable by keyboard', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await fresh(page);
    const needed: Seen[] = ['choice-tp-en', 'choice-en-tp', 'glyph-word', 'word-glyph', 'typed', 'fill', 'build', 'spot', 'translate', 'flash'];
    const seen = new Set<Seen>();
    // spot-the-mistake practises li / pi / ala / en / e; fill-in practises particles
    const words = ['li', 'e', 'pi', 'ala', 'en', 'la', 'o', 'soweli', 'moku', 'jan', 'telo', 'kili', 'tomo', 'pona', 'mi', 'sina', 'lukin', 'suli'];
    for (let round = 0; round < 8 && needed.some((k) => !seen.has(k)); round++) {
      // alternate early cards (1 review: choice formats, word → glyph) and mature ones (harder formats)
      await importMature(page, words, ['recognise', 'recall', 'glyph'], round % 2 ? 1 : 6);
      await page.locator('.learn-start').click();
      for (let i = 0; i < 80 && (await page.locator('.learn-session').count()); i++) seen.add(await answerCorrectly(page));
    }
    expect(needed.filter((k) => !seen.has(k))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a wrong answer is shown, explained, and the card comes back later', async ({ page }) => {
    await fresh(page);
    // early-stage cards (1 review) are always asked as multiple choice
    await importMature(page, ['soweli', 'waso', 'kala', 'pipi', 'akesi'], ['recognise'], 1);
    await page.locator('.learn-start').click();
    await expect(page.locator('.learn-session')).toBeVisible();
    // answer until a multiple-choice question (either direction) comes up
    let right = await correctChoiceIndex(page);
    for (let i = 0; i < 12 && right < 0; i++) {
      await answerCorrectly(page);
      right = await correctChoiceIndex(page);
    }
    expect(right).toBeGreaterThanOrEqual(0);
    // the word being asked about, and its meaning, whichever direction the question runs
    const label = await page.locator('.learn-prompt .card-label').first().textContent();
    let asked: string;
    if (label === 'What does this mean?') {
      asked = (await page.locator('.learn-prompt [lang=tok]').first().textContent())!.trim();
    } else {
      const gloss = (await page.locator('.learn-prompt .card-gloss').textContent())!.trim();
      asked = WORDS.find((w) => w.concept === gloss)!.id;
    }
    const meaning = conceptOf(asked);
    const totalBefore = Number((await page.locator('.learn-session .progress-meta span').first().innerText()).match(/of (\d+)/)![1]);
    // deliberately choose a wrong option
    await page.keyboard.press(String(right === 0 ? 2 : 1));
    await expect(page.locator('.feedback-title')).toHaveText('ike…');
    await expect(page.locator('.option.is-correct')).toHaveCount(1);
    await expect(page.locator('.option.is-wrong')).toHaveCount(1);
    await page.keyboard.press('Enter');
    // the missed card is re-queued: the session grows by one and the word appears again
    const totalAfter = Number((await page.locator('.learn-session .progress-meta span').first().innerText()).match(/of (\d+)/)![1]);
    expect(totalAfter).toBe(totalBefore + 1);
    // the card comes back later in the session — possibly in a harder format, since
    // formats depend on its review count — so look for the word or its meaning
    let again = false;
    for (let i = 0; i < 12 && (await page.locator('.learn-session').count()); i++) {
      const text = await page.locator('.learn-prompt').innerText();
      if (new RegExp(`\\b${asked}\\b`).test(text) || text.includes(meaning)) again = true;
      await answerCorrectly(page);
    }
    expect(again).toBe(true);
  });

  test('the listening setting follows whether a Spanish or Italian voice exists', async ({ page }) => {
    await fresh(page);
    await page.waitForTimeout(1700); // voices load asynchronously; the app waits up to 1.5 s
    const hasVoice = await page.evaluate(() => speechSynthesis.getVoices().some((v) => /^(es|it)/i.test(v.lang)));
    await page.getByRole('button', { name: 'Settings' }).click();
    const toggle = page.getByRole('checkbox', { name: /Listening exercises/ });
    if (hasVoice) await expect(toggle).toBeEnabled();
    else await expect(toggle).toBeDisabled();
  });
});

test('placement test can skip ahead', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /placement test/ }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Stop here' }).click();
  await expect(page.locator('.done-label')).toHaveText('Placement result');
  await page.getByRole('button', { name: /Start at unit 1/ }).click();
  await expect(page.locator('.learn-title')).toHaveText('Next: unit 1');
});

