import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fresh, importMature } from './helpers';

/**
 * Automated accessibility audit (axe-core, WCAG 2.2 A/AA) of every screen, in light
 * and dark themes. Serious and critical violations fail the build; anything else is
 * reported so it can be reviewed.
 */

type Screen = { name: string; go: (page: Page) => Promise<void> };

const nav = (name: RegExp | string) => async (page: Page) => {
  await page.getByRole('button', { name }).first().click();
};

const SCREENS: Screen[] = [
  { name: 'learn home + path', go: async () => {} },
  { name: 'unit lesson', go: async (p) => { await p.keyboard.press('Enter'); await expect(p.locator('#unit-title')).toBeVisible(); } },
  {
    name: 'checkpoint',
    go: async (p) => {
      await p.locator('.stop.is-current .stop-btn').click();
      await p.getByRole('button', { name: /^Checkpoint/ }).click();
      await expect(p.locator('.story')).toBeVisible();
    },
  },
  {
    name: 'learn session: intro',
    go: async (p) => {
      await p.keyboard.press('Enter');
      await p.getByRole('button', { name: 'Start practising these words' }).click();
      await expect(p.locator('.learn-intro')).toBeVisible();
    },
  },
  {
    name: 'learn session: exercise + feedback',
    go: async (p) => {
      await importMature(p, ['pona', 'jan', 'toki', 'moku', 'soweli'], ['recognise'], 1);
      await p.locator('.learn-start').click();
      await p.keyboard.press('1');
      await expect(p.locator('.feedback')).toBeVisible();
    },
  },
  { name: 'placement', go: async (p) => { await p.getByRole('button', { name: /placement test/ }).click(); await p.getByRole('button', { name: 'Begin' }).click(); } },
  { name: 'settings dialog', go: async (p) => { await nav('Settings')(p); await expect(p.locator('dialog[open]')).toBeVisible(); } },
  { name: 'play hub', go: nav(/^Play/) },
  { name: 'daily sentence', go: async (p) => { await nav(/^Play/)(p); await p.locator('.play-tile', { hasText: 'Daily sentence' }).click(); } },
  { name: 'speed round', go: async (p) => { await nav(/^Play/)(p); await p.locator('.play-tile', { hasText: 'Speed round' }).click(); await p.keyboard.press('Enter'); } },
  {
    name: 'name game',
    go: async (p) => {
      await nav(/^Play/)(p);
      await p.locator('.play-tile', { hasText: 'Your name' }).click();
      await p.getByPlaceholder('Type a name…').fill('Lisa');
    },
  },
  { name: 'compound puzzles', go: async (p) => { await nav(/^Play/)(p); await p.locator('.play-tile', { hasText: 'Compound puzzles' }).click(); } },
  { name: 'glyph tracing', go: async (p) => { await nav(/^Play/)(p); await p.locator('.play-tile', { hasText: 'Glyph tracing' }).click(); } },
  { name: 'free practice: quiz', go: async (p) => { await nav(/^Play/)(p); await p.locator('.play-tile', { hasText: 'Free practice' }).click(); await nav('Quiz')(p); } },
  {
    name: 'dictionary: entry',
    go: async (p) => {
      await nav('Dictionary')(p);
      await p.getByPlaceholder('Search toki pona or English…').fill('tomo');
      await p.locator('.entry summary').first().click();
    },
  },
  { name: 'dictionary: glyph book', go: async (p) => { await nav('Dictionary')(p); await p.getByRole('tab', { name: 'Glyph book' }).click(); } },
  { name: 'dictionary: phrases', go: async (p) => { await nav('Dictionary')(p); await p.getByRole('tab', { name: 'Phrases' }).click(); } },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`a11y (${theme})`, () => {
    for (const screen of SCREENS) {
      test(screen.name, async ({ page }) => {
        await fresh(page, { theme });
        await screen.go(page);
        await page.waitForTimeout(700); // let entrance animations settle so contrast is measured on final colours
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        const report = (vs: typeof results.violations) =>
          vs.map((v) => `${v.impact} ${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        if (results.violations.length > blocking.length) {
          test.info().annotations.push({ type: 'a11y-minor', description: report(results.violations.filter((v) => !blocking.includes(v))).join('\n') });
        }
        expect(report(blocking)).toEqual([]);
      });
    }
  });
}
