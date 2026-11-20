/**
 * Collect licence texts for everything that ships to the browser.
 *
 *   node scripts/build-notices.mjs   → public/THIRD_PARTY_NOTICES.txt
 *
 * Runtime npm dependencies (and their runtime dependencies) plus the bundled font data.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const seen = new Set();
const entries = [];

function licenceText(dir) {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  return file ? readFileSync(join(dir, file), 'utf8').trim() : null;
}

function visit(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const dir = join('node_modules', name);
  if (!existsSync(join(dir, 'package.json'))) return;
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  entries.push({ name: `${name}@${meta.version}`, licence: meta.license ?? 'see text', text: licenceText(dir) });
  for (const dep of Object.keys(meta.dependencies ?? {})) visit(dep);
}

for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep);

entries.push({
  name: 'nasin nanpa 4.0.2 (sitelen pona glyph outlines, embedded as SVG path data)',
  licence: 'MIT',
  text: readFileSync('assets/fonts/nasin-nanpa-LICENSE.txt', 'utf8').trim(),
});

const out = [
  'nimi pona — third-party notices',
  '================================',
  '',
  'This app includes the following third-party software and data.',
  '',
  ...entries.flatMap((e) => [
    '-'.repeat(72),
    `${e.name} — ${e.licence}`,
    '-'.repeat(72),
    e.text ?? '(licence text not included in the package; see the package repository)',
    '',
  ]),
].join('\n');

writeFileSync('public/THIRD_PARTY_NOTICES.txt', out + '\n');
console.log(`wrote public/THIRD_PARTY_NOTICES.txt (${entries.length} entries)`);
for (const e of entries) console.log(' ', e.name, '—', e.licence, e.text ? '' : '(no text)');
