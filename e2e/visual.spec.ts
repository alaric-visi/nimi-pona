import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

/**
 * Visual regression snapshots of the key screens, light and dark, desktop and mobile.
 * Time is frozen and Math.random seeded so the daily sentence, shuffles and the garden
 * render identically every run. Update baselines deliberately with:
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 */

async function deterministic(page: Page) {
  await page.clock.setFixedTime(new Date('2026-06-15T10:00:00'));
  await page.addInitScript(() => {
    // no speech voices: voices load asynchronously, which would make Listen buttons flicker in/out
    if (typeof speechSynthesis !== 'undefined') Object.defineProperty(speechSynthesis, 'getVoices', { value: () => [] });
    let seed = 42;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

const shot = async (page: Page, name: string) => {
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: 'disabled', caret: 'hide' });
};

for (const theme of ['light', 'dark'] as const) {
  test.describe(`visual (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await deterministic(page);
      await fresh(page, { theme });
    });

    test('learn home and path', async ({ page }) => {
      await shot(page, `learn-home-${theme}`);
    });

    test('unit 1 lesson', async ({ page }) => {
      await page.keyboard.press('Enter');
      await expect(page.locator('#unit-title')).toBeVisible();
      await shot(page, `unit-lesson-${theme}`);
    });

    test('new word introduction', async ({ page }) => {
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Start practising these words' }).click();
      await expect(page.locator('.learn-intro')).toBeVisible();
      await shot(page, `intro-${theme}`);
    });

    test('play hub', async ({ page }) => {
      await page.getByRole('button', { name: /^Play/ }).click();
      await expect(page.locator('.play-tiles')).toBeVisible();
      await shot(page, `play-hub-${theme}`);
    });

    test('glyph book', async ({ page }) => {
      await page.getByRole('button', { name: 'Dictionary' }).click();
      await page.getByRole('tab', { name: 'Glyph book' }).click();
      await expect(page.locator('.glyph-cell').first()).toBeVisible();
      await shot(page, `glyph-book-${theme}`);
    });

    test('settings dialog', async ({ page }) => {
      await page.getByRole('button', { name: 'Settings' }).click();
      await expect(page.locator('dialog[open]')).toBeVisible();
      await settle(page);
      await expect(page.locator('dialog[open]')).toHaveScreenshot(`settings-${theme}.png`, { animations: 'disabled' });
    });
  });
}
