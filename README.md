# nimi pona

A calm Toki Pona course-game. See [`PLAN.md`](PLAN.md) for the roadmap and [`docs/`](docs/) for the language reference and the legacy audit.

## Run

```bash
npm install
npm run dev            # dev server
npm run build          # notices → typecheck → production build (PWA) → JS budget check (150 KB gz)
npm run preview        # serve the production build locally
```

## Test

```bash
npm run check          # typecheck + unit/content tests (Vitest)
npm run lint:content   # content gate only: phonotactics, grammar lints, vocabulary order, example coverage
npm run test:e2e       # end-to-end, accessibility (axe) and visual tests (Playwright, against the production build)
npm run test:all       # everything
```

- **End-to-end tests** answer exercises the way a learner would. They use the content files and the language toolkit, not hidden answers in the page. They cover the full unit-1 flow, every exercise type, wrong-answer handling, the placement test, every game and the dictionary, on desktop and mobile.
- **Accessibility:** axe checks 17 screens (WCAG 2.2 AA) in light and dark themes, and fails on serious or critical issues.
- **Visual baselines** live in `e2e/visual.spec.ts-snapshots/`. They are platform-specific (`-darwin`); on another OS, regenerate them with `npx playwright test e2e/visual.spec.ts --update-snapshots`.
- Playwright needs Chromium: `npx playwright install chromium` if it isn't already cached.

## Release

`npm run build` produces a static, installable, offline-capable PWA in `dist/`. Host it on any static host; there is no backend.
- Serve `dist/` with SPA-friendly defaults; there are no client routes, so plain static hosting works.
- Use HTTPS (required for the service worker and installation).
- Progress lives in each visitor's browser (IndexedDB). Settings → Progress offers export, import and reset.
- Lighthouse on the production build: desktop 100 / 100 / 100 / 100 and mobile 98 / 100 / 100 / 100 (performance / accessibility / best practices / SEO).

## Maintenance scripts

```bash
npm run build:glyphs   # re-extract sitelen pona glyphs from the font → src/data/glyphs.json
npm run build:icons    # render app icons (SVG + PNG) from the pona glyph
npm run build:notices  # regenerate public/THIRD_PARTY_NOTICES.txt from shipped dependencies
npm run size           # report initial-load JS against the budget
```

## Layout

- `content/words.yaml`: vocabulary (138 words; schema documented at the top of the file)
- `content/sentences.yaml`: example corpus with translations. Words, grammar concepts and difficulty are derived automatically.
- `content/units.yaml`: the learning path: 16 units + a bonus ku unit, each with a lesson and checkpoint story. `content/phrases.yaml` is the phrasebook; `content/compounds.yaml` lists common compounds.
- `src/data/`: typed content loaders with validation
- `src/lang/`: Toki Pona toolkit: tokenizer, phonotactics, grammar lints and concept tags, numbers, name adapter
- `src/engine/`: pure, unit-tested logic: free-practice decks (`deck.ts`, `session.ts`), spaced repetition (`srs.ts`, FSRS), the session planner and runner (`planner.ts`), exercise generators and graders (`exercises.ts`), and answer checking (`answers.ts`)
- `src/engine/path.ts`: unit status, gating, placement (pure, unit-tested)
- `src/app/learn.ts`: Learn mode state and IndexedDB persistence; `src/app/speech.ts`: Toki Pona through a Spanish voice
- `src/ui/learn/`: Learn mode screens: path map, unit lessons, checkpoints, placement, sessions and exercises
- `src/ui/dict/`: the Dictionary tab (search, glyph book, phrasebook)
- `src/ui/play/` + `src/app/play.ts`: the Play section: garden, daily sentence, speed round, name game, compound puzzles (`content/puzzles.yaml`), glyph tracing
- `src/engine/play.ts`, `recognizer.ts` ($P gesture recogniser), `pathSample.ts` (SVG path sampling): pure game logic
- `src/app/`: signals store, persistence and keyboard shortcuts
- `src/ui/`: Preact components and the ink-and-paper styles (`styles/tokens.css` holds the design tokens)
- `assets/fonts/`: nasin nanpa (sitelen pona font, MIT, by jan Itan). Used only at build time by `scripts/build-glyphs.mjs`.
- `docs/style-guide.md`: design tokens, glyph usage, motion and voice
- `e2e/`: Playwright tests: Learn flows, every exercise, games, accessibility, visual snapshots
- `scripts/`: glyph extraction, icon rendering, licence notices, bundle budget
- `legacy/index.html`: the original single-file app, kept for reference

## Credits

- Toki Pona was created by Sonja Lang (*Toki Pona: The Language of Good*, 2014).
- sitelen pona glyphs: [nasin nanpa](https://github.com/ETBCOR/nasin-nanpa) by jan Itan, MIT licence (`assets/fonts/nasin-nanpa-LICENSE.txt`).
- Fonts: Fraunces and Atkinson Hyperlegible via Fontsource (SIL OFL).
- Full third-party licence texts: `public/THIRD_PARTY_NOTICES.txt` (also linked from About & credits in the app).
- This project doesn't yet declare its own licence; choose one before publishing the source.
