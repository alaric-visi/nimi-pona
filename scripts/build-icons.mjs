/**
 * Render the app icons from the pona glyph.
 *
 *   node scripts/build-icons.mjs
 *
 * Writes public/icon-maskable.svg plus PNGs (192, 512, maskable 512, apple-touch 180)
 * using Playwright's Chromium, so the PNGs match the SVG exactly.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const glyphs = JSON.parse(readFileSync('src/data/glyphs.json', 'utf8')).glyphs;
const { d, box } = glyphs.pona;
const [x, y, w, h] = box;

/** The pona glyph centred on a vermilion tile. `fill` = share of the tile the glyph spans. */
function svg({ radius, fill }) {
  const s = (512 * fill) / Math.max(w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#b0412b"/>
  <!-- sitelen pona "pona" (nasin nanpa by jan Itan, MIT) -->
  <path fill="#fbf8f1" transform="translate(256 256) scale(${s.toFixed(3)}) translate(${-(x + w / 2)} ${-(y + h / 2)})" d="${d}"/>
</svg>
`;
}

// regular icon: rounded tile; maskable: full-bleed, glyph inside the 80% safe zone
writeFileSync('public/icon.svg', svg({ radius: 112, fill: 0.62 }));
writeFileSync('public/icon-maskable.svg', svg({ radius: 0, fill: 0.5 }));

const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (file, size, out) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${readFileSync(file, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', out);
};
await render('public/icon.svg', 192, 'public/icon-192.png');
await render('public/icon.svg', 512, 'public/icon-512.png');
await render('public/icon-maskable.svg', 512, 'public/icon-maskable-512.png');
await render('public/icon-maskable.svg', 180, 'public/apple-touch-icon.png');
await browser.close();
