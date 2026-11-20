import { expect, test } from '@playwright/test';
import { fresh, importMature, PUZZLES, watchErrors, WORDS } from './helpers';

const goPlay = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: /^Play/ }).click();
  await expect(page.locator('.play-tiles')).toBeVisible();
};

test('Play hub: garden grows from learned words, calendar shows practice', async ({ page }) => {
  const errors = watchErrors(page);
  await fresh(page);
  await goPlay(page);
  await expect(page.locator('.plant')).toHaveCount(0);
  await expect(page.locator('.garden-caption').first()).toContainText('A plant grows for every word');
  await page.getByRole('button', { name: /^Learn/ }).click();
  await importMature(page, ['pona', 'jan', 'toki', 'moku'], ['recognise']);
  await goPlay(page);
  await expect(page.locator('.plant')).toHaveCount(4);
  await expect(page.locator('.calendar-day')).toHaveCount(28);
  expect(errors).toEqual([]);
});

test('daily sentence: reveal marks today as practised', async ({ page }) => {
  await fresh(page);
  await goPlay(page);
  await page.locator('.play-tile', { hasText: 'Daily sentence' }).click();
  await expect(page.locator('.daily-tok')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Show the meaning' }).click();
  await expect(page.locator('.daily-en')).not.toBeEmpty();
  await page.locator('.back-link').click();
  await expect(page.locator('.play-tile-badge')).toBeVisible();
  await expect(page.locator('.calendar-day.is-today.is-practised')).toHaveCount(1);
});

test('speed round scores correct answers by keyboard', async ({ page }) => {
  await fresh(page);
  await goPlay(page);
  await page.locator('.play-tile', { hasText: 'Speed round' }).click();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 5; i++) {
    const word = (await page.locator('.learn-prompt [lang=tok]').first().textContent())!.trim();
    const concept = WORDS.find((w) => w.id === word)!.concept;
    const texts = await page.locator('.option-text').allTextContents();
    await page.keyboard.press(String(texts.indexOf(concept) + 1));
    await expect(page.locator('.speed-score')).toHaveText(String(i + 1));
  }
});

test('name game: adapts a name, spells the cartouche, saves an image', async ({ page }) => {
  await fresh(page);
  await goPlay(page);
  await page.locator('.play-tile', { hasText: 'Your name' }).click();
  await page.getByPlaceholder('Type a name…').fill('Canada');
  await page.getByRole('button', { name: /ma · a place/ }).click();
  await expect(page.locator('.name-latin')).toHaveText('ma Kanata');
  await expect(page.locator('.name-card .cartouche svg')).toHaveCount(6);
  // the image is generated and offered as a download (Web Share isn't available headless)
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: () => false }));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as an image' }).click();
  expect((await download).suggestedFilename()).toBe('ma-Kanata.png');
});

test('compound puzzle: accepts a valid description', async ({ page }) => {
  await fresh(page);
  await goPlay(page);
  await page.locator('.play-tile', { hasText: 'Compound puzzles' }).click();
  const en = (await page.locator('.card-gloss').textContent())!.trim();
  const answer = PUZZLES.find((p) => p.en === en)!.accept[0].split(' ');
  for (const w of answer) await page.locator('.tile-bank .tile', { hasText: new RegExp(`^\\d?${w}$`) }).first().click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await expect(page.locator('.feedback-title')).toHaveText('pona!');
  await expect(page.locator('.checkpoint-intro')).toContainText('1/');
});

test('glyph tracing: a drawn X is read as ala', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Dictionary' }).click();
  await page.getByRole('tab', { name: 'Glyph book' }).click();
  await page.getByRole('button', { name: /^ala( \(not met yet\))?$/ }).click();
  await expect(page.locator('.glyph-card-word')).toHaveText('ala');
  await page.getByRole('button', { name: 'Trace it' }).click();
  await expect(page.locator('.trace-prompt')).toContainText('ala');
  const box = (await page.locator('.trace-canvas').boundingBox())!;
  const stroke = async (x1: number, y1: number, x2: number, y2: number) => {
    await page.mouse.move(box.x + x1 * box.width, box.y + y1 * box.height);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(box.x + (x1 + ((x2 - x1) * i) / 12) * box.width, box.y + (y1 + ((y2 - y1) * i) / 12) * box.height);
    }
    await page.mouse.up();
  };
  await stroke(0.22, 0.2, 0.78, 0.8);
  await stroke(0.78, 0.2, 0.22, 0.8);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback-title')).toHaveText('pona!');
});

test('dictionary search finds words by English and by compound', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Dictionary' }).click();
  const search = page.getByPlaceholder('Search toki pona or English…');
  await search.fill('cute');
  await expect(page.locator('.entry-word').first()).toHaveText('suwi');
  await search.fill('car');
  await expect(page.locator('.entry-word').nth(0)).toHaveText('tawa');
  await expect(page.locator('.entry-word').nth(1)).toHaveText('tomo');
  await page.locator('.entry summary').nth(1).click();
  await expect(page.locator('.entry-compounds')).toContainText('tomo tawa');
});

test('free practice still works from Play', async ({ page }) => {
  await fresh(page);
  await goPlay(page);
  await page.locator('.play-tile', { hasText: 'Free practice' }).click();
  await expect(page.locator('.chips')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('.card.is-flipped')).toHaveCount(1);
  await page.keyboard.press('2');
  await expect(page.locator('.progress-meta')).toContainText('1/1 correct');
});
