/**
 * Performance budget: JavaScript needed for first load ≤ 150 KB gzipped.
 *
 *   node scripts/check-size.mjs   (after npm run build)
 *
 * Counts the entry script and every module index.html preloads; lazy chunks are listed
 * separately and don't count toward the initial budget.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 150;
const html = readFileSync('dist/index.html', 'utf8');
const initial = new Set([...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]));
const kb = (file) => gzipSync(readFileSync(`dist/${file}`)).length / 1024;

let total = 0;
console.log('initial load:');
for (const f of initial) {
  const size = kb(f);
  total += size;
  console.log(`  ${f.padEnd(42)} ${size.toFixed(1).padStart(6)} KB gz`);
}
const lazy = readdirSync('dist/assets').filter((f) => f.endsWith('.js') && !initial.has(`assets/${f}`));
if (lazy.length) {
  console.log('lazy chunks:');
  for (const f of lazy) console.log(`  assets/${f.padEnd(35)} ${kb(`assets/${f}`).toFixed(1).padStart(6)} KB gz`);
}
console.log(`total initial JS: ${total.toFixed(1)} KB gz (budget ${BUDGET_KB} KB)`);
if (total > BUDGET_KB) {
  console.error('✗ over budget');
  process.exit(1);
}
console.log('✓ within budget');
