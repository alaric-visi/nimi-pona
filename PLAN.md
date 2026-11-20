# nimi pona: phased improvement plan

**Goal:** turn a 121-card flashcard toy into a small, beautiful, *correct* Toki Pona course-game that takes someone from zero to reading simple Toki Pona and *sitelen pona*.

Supporting documents:
- [`docs/toki-pona-reference.md`](docs/toki-pona-reference.md): language facts and what each one means for design
- [`docs/legacy-audit.md`](docs/legacy-audit.md): bugs, data errors and debt in the current build
- [`legacy/index.html`](legacy/index.html): the original, preserved unchanged

---

## Guiding principles

1. **Teach how Toki Pona actually works.** Words are *semantic spaces*, grammar is a handful of particles, and meaning comes from composition. Glossary memorisation is a means, not the goal.
2. **sitelen pona is the visual identity.** The language ships with its own beautiful script, so use it everywhere instead of a borrowed retro-terminal look.
3. **pona = simple, good.** A calm interface with gentle motivation: no punishing streaks or heavy gamification. The design should feel like the language.
4. **Content is data, and data is linted.** Every example sentence is machine-checked (phonotactics, known words, particle rules) before it ships.
5. **Offline-first and accessible.** It installs as a PWA, works without a network, and is fully keyboard and screen-reader usable.

---

## Target structure

```
toki-pona/
├── PLAN.md
├── legacy/index.html            # original, untouched
├── docs/                        # reference, audit, ADRs, style guide
├── content/                     # HUMAN-AUTHORED source of truth (YAML)
│   ├── words.yaml               # glosses, roles, themes, synonyms, tier, notes
│   ├── sentences.yaml           # example sentences + translations + word tags
│   ├── lessons/                 # one file per unit: intro text, word set, exercises
│   └── phrases.yaml
├── scripts/                     # (planned) import-linku.ts, build-glyphs.ts
├── src/
│   ├── main.ts
│   ├── app/                     # router, global store, persistence
│   ├── lang/                    # tokenizer, phonotactics, grammar checks, numbers, name-adapter
│   ├── engine/                  # SRS scheduler, session builder, exercise generators, grader
│   ├── ui/
│   │   ├── styles/              # tokens.css, base.css, motion.css
│   │   ├── components/          # Card, Glyph, OptionGrid, TileBoard, ProgressRing …
│   │   └── screens/             # Home/Path, Lesson, Review, Dictionary, Glyphs, Settings
│   └── assets/                  # fonts, glyph SVGs, audio, illustrations
├── public/                      # manifest, icons
└── tests/                       # unit (lang/engine) + e2e (Playwright)
```

**Recommended stack:** Vite + TypeScript + **Preact with Signals** (tiny runtime, component model for the richer exercise UIs) + plain CSS with custom-property tokens. Supporting libraries: **ts-fsrs** for spaced repetition, **idb-keyval** for IndexedDB storage, **vite-plugin-pwa** for offline, **Vitest + Playwright** for tests. No backend.

---

## Phase 0: Foundation and bug fixes *(small)*: ✅ done 2026-11-20

> **Status:** Built with Vite 6, TypeScript, Preact and Signals. Every audited bug is fixed, the 6 example sentences with a known fix are corrected (the `unpa` content policy waits for Phase 1), and 12 engine unit tests pass. The interface uses an "ink and paper" base theme (Fraunces for Toki Pona text, Atkinson Hyperlegible for the UI). It works offline as a PWA, settings and lifetime stats persist, and it's fully keyboard-driven.
> **Still open:** a Lighthouse run hasn't been done; there's no PNG app icon yet (SVG only); `npm audit` reports 4 moderate build-time-only advisories in workbox's `minimatch`.
> **Decisions taken:** "ink and paper" art direction (approved). Preact + Signals. Vite pinned to 6 because Node 20.18 is below Vite 7's minimum.

**Purpose:** make the app safe to build on.

- Scaffold the structure above. Move `WORDS` into `content/words.yaml`, with a build step that compiles it to typed JSON.
- Port the existing three modes (Flash, Quiz, EN→TP) to components, keeping behaviour the same.
- Fix all functional bugs in the audit:
  - wrong answers highlighting three options green
  - newlines collapsing on the done screen
  - NEXT bypassing self-grading
  - the flip `setTimeout` race
  - synonym distractors
  - the forced 1.5 s auto-advance
- Theme: tokens on `:root`, dark via `prefers-color-scheme` with a manual override, and **no parent-frame access**.
- Layout: `100dvh` with scrollable content and a mobile-first layout.
- Self-host fonts. Add a PWA manifest and service worker.
- Accessibility baseline:
  - focusable flip card using `button` + `aria-live`
  - keyboard: Space flips, 1–4 answers, ←/→ navigate
  - `prefers-reduced-motion`
  - AA contrast
- Persist settings and session stats locally.
- **Exit criteria:** feature parity with legacy, zero known bugs, Lighthouse a11y ≥ 95, works offline.

## Phase 1: Correct, rich content *(medium; the most important phase)*: ✅ done 2026-11-20

> **Status:** `content/words.yaml` holds 138 words: all 120 pu words, the 3 pu synonyms (`kin`, `namako`, `oko`; `ali` is a spelling variant of `ale`) and 15 ku-tier community words. Each has roles, themes, a concept line, accepted glosses, synonyms, notes and a glyph key. `content/sentences.yaml` has 297 hand-written sentences with English translations (plus alternatives). Every word appears in at least 2 of them. `src/lang/` provides a tokenizer, a phonotactics validator, 6 grammar lints, concept tagging, difficulty scoring, pu-style number conversion and a name adapter. `npm run lint:content` gates all content. The app now filters by 17 topics, shows translated examples and usage notes on cards, and has a Words settings dialog: ku words and `unpa` are off by default.
> **Deviations:** the content linter runs as a Vitest suite (`tests/content.test.ts`) rather than a standalone script. Grammar concepts and difficulty are derived automatically rather than hand-tagged.
> **Deferred:** the Linku import is not built yet. It needs a licence check and a data download first. The ku-tier word list should be checked against Linku's usage categories at the same time. Until then, content is hand-authored.

**Purpose:** a data model worthy of the language.

- **New word schema:**
  ```yaml
  - id: moku
    tier: pu            # pu | pu-synonym | ku-suli | common
    roles: [content, preverb?]   # content | particle | preverb | preposition | pronoun | number | interjection
    themes: [food, action]
    concept: "eating, drinking, consuming; food"
    glosses: [eat, drink, food, meal, consume, swallow]
    synonyms: []        # e.g. lukin ↔ oko
    glyph: moku         # sitelen pona asset key
    audio: moku.mp3
    notes: "Covers drinking too — telo is drunk with moku."
    sensitive: false
  ```
- **Separate axes:** *grammar role* (from pu) and *semantic theme*, replacing the mixed `cat` field.
- **Sentences as first-class data.** About 300–500 sentences, each with:
  - an English translation
  - alternative accepted translations
  - the words used (auto-tagged)
  - the grammar concepts used (e.g. `pi`, `la`, `preverb`)
  - a difficulty level
- Fix the seven bad examples in the audit. Write ≥2 examples per word.
- `scripts/import-linku.ts` seeds definitions and usage tier from Linku, with attribution. Humans curate on top of that.
- **`src/lang/`** language toolkit (all unit-tested):
  - tokenizer and phonotactics validator
  - grammar lints: `li` after bare `mi`/`sina`, `pi` + one word, `ala` position, `en` misuse
  - number converter (simple + pu-style `mute luka tu wan` ↔ 28)
  - name adapter (see the reference doc, §6)
- `lint-content.ts` runs in CI and fails on unknown words, phonotactic violations or grammar-rule hits.
- Add pu synonyms `kin`/`namako`/`ali`. Include **ku suli** words as an optional "beyond pu" tier.
- Content policy: `unpa` stays in the dictionary but is excluded from games by default (with a setting to include it).
- **Exit criteria:** every word has a concept line, glosses, ≥2 linted and translated examples, and a glyph key. The linter passes.

## Phase 2: Visual identity and graphics *(medium–large)*: ✅ done 2026-11-20

> **Status:** sitelen pona glyphs come from *nasin nanpa* 4.0.2 by jan Itan (MIT, downloaded from its official GitHub release). `npm run build:glyphs` extracts all 138 glyphs to SVG path data, so the app ships no font.
> - **Glyphs everywhere:** card hero, answer line, example sentences written in sitelen pona with name cartouches, topic-chip icons, a vermilion `pona` seal in the header and as the app icon, and a drawn glyph on the done screen.
> - **Motion:** glyphs trace in, then fill. An ink reveal from the touch point replaces the 3D flip. Cards tilt toward the mouse. The glyph blooms on a correct answer and is traced again on a wrong one.
> - **Settings:** a writing choice (glyph + Latin / glyphs only / Latin only) and an optional synthesised sound palette.
> - **Style guide:** [`docs/style-guide.md`](docs/style-guide.md).
>
> **Deviations:** the topic illustrations are each topic's own sitelen pona glyph rather than separate drawings. Hand-tuned single-stroke SVGs weren't needed, because tracing the font outlines already reads as ink.
> **Still open:** there's no PNG icon for older install surfaces, and no screenshot-based visual-regression tests (Phase 6).

**Purpose:** make it look like Toki Pona, not a terminal.

**Art direction (recommended): "ink and paper"**
- Warm paper background (light) and deep ink-blue night (dark, *tenpo pimeja*).
- One brush-ink accent colour, plus a muted secondary per theme.
- Generous whitespace and soft corner radii.
- Type: a humanist sans for UI and Latin Toki Pona (e.g. Atkinson Hyperlegible or Nunito), and a sitelen pona font for glyphs.

**Work items**
- **Design tokens and style guide** (`docs/style-guide.md`): colour, type scale, spacing, radii, elevation, motion durations and easing.
- **sitelen pona everywhere:**
  - glyph as the card hero
  - Latin word beneath
  - a toggle to show glyph-only or Latin-only
  - a cartouche renderer for names
- **Glyph stroke animation on reveal.** Animate SVG `stroke-dashoffset`. Start from font outlines, then upgrade to hand-tuned single-stroke SVGs for the 137 core words.
- **Card redesign:**
  - real depth (layered shadow, slight tilt on hover/pointer)
  - a page-turn or ink-bleed reveal instead of a plain Y-flip
  - a tactile press state
- **Feedback motion:**
  - correct: a soft bloom plus the glyph "settling"
  - wrong: a gentle shake plus the right answer drawn in
  - all reduced-motion aware
- **Theme illustrations.** Small spot illustrations per semantic theme (nature, food, body …), drawn *in the visual vocabulary of sitelen pona* (simple strokes, circles, lines). These double as compound-word puzzle prompts in Phase 4.
- **Optional audio palette:** soft wooden or chime tones for correct, wrong and level-up, with a mute setting.
- **Exit criteria:** style guide written. All screens use tokens. Glyphs render for every word. Visual QA in light/dark × mobile/desktop.

## Phase 3: Learning engine *(medium)*: ✅ done 2026-11-20

> **Status:** a new **Learn** mode (the default) runs spaced repetition with FSRS (`ts-fsrs` 5.4, 90% target retention).
> - **Cards:** each word has up to four skill cards: meaning, recall, sitelen pona, listening. Follow-on skills unlock once recognition is learned.
> - **Sessions:** a short session mixes due reviews (least-remembered first), unlocked skills and new words (in corpus-frequency order, within a daily limit). Missed and new cards come back later in the same session.
> - **Exercises:** all nine types are built, plus a new-word introduction card. Each one has a pure generator and grader (`src/engine/exercises.ts`) and is fully keyboard-operable:
>   - choice in both directions
>   - typed recall with one-typo tolerance for words over four letters
>   - glyph → word and word → glyph
>   - listening (choice, then typed)
>   - particle fill-in (never offers two particles that both fit)
>   - sentence builder
>   - spot the mistake (errors generated from the corpus and verified by the grammar linter)
>   - TP→EN translation (keyword grading with an "I was right" override)
>   - self-graded flashcards
> - **Listening:** uses a Spanish voice, respelled for Toki Pona: `j`→`y`, and first-syllable stress forced with an accent on words of three or more syllables.
> - **Storage:** progress lives in IndexedDB, with JSON export, import and reset in Settings.
> - **Simulated learner:** a 7-day run (`tests/learning.test.ts`, independent memory model) gives 88.5% first-try recall on review days, about 77 reviews a day across two sessions, and 70 words introduced.
>
> **Deviations:** the sentence builder uses tap/keyboard placement instead of drag-and-drop, because it's more accessible and works the same on phones.
> **Still open:** human pronunciation recordings to replace speech synthesis, and a per-word mastery view (planned for the Phase 4 dictionary).

**Purpose:** move from shuffled decks to real retention.

- **Spaced repetition with FSRS** (`ts-fsrs`). Each word × skill pair is a separate card:
  - *recognise* (tp→meaning)
  - *recall* (meaning→tp)
  - *glyph* (sitelen→word)
  - *listen* (audio→word)
- **Session builder:** mixes due reviews, new items from the current unit and a few "stretch" items. Sessions are short (5–10 min) with a clear end.
- **Exercise types** (each one a generator plus a grader):
  1. Flashcard with self-grade (Again / Hard / Good / Easy)
  2. Multiple choice with **semantically filtered distractors**
  3. Typed recall with typo tolerance (Levenshtein ≤1 for words over 4 letters) and set-based accepted answers
  4. Glyph → word, and word → glyph
  5. Listen → pick or type (Web Speech `es`/`it` voice as a stopgap, recordings later)
  6. **Particle fill-in:** `jan ___ moku ___ kili` → `li`, `e`
  7. **Sentence builder:** drag word tiles into the correct order
  8. **Spot the mistake:** `mi li pona.` → tap the wrong word, see why
  9. **Translate (TP→EN)** with keyword-based grading and model answers shown
- **Persistence:** IndexedDB for review history and progress, plus JSON export/import (no account needed).
- **Exit criteria:** engine unit-tested. A 7-day simulated learner reaches the expected retention curve. All 9 exercise types work with keyboard only.

## Phase 4: Learning pathway *(large; the core of "extending gameplay")*: ✅ done 2026-11-20

> **Status:** `content/units.yaml` holds the 16 units in the table below plus the optional ★ "Beyond pu" unit, which appears when ku words are enabled.
> - **Each unit:** a one-screen lesson (idea, points, examples with sitelen pona and audio), its new words, the phrases it unlocks, and a checkpoint (a dialogue or story plus comprehension questions; unit 15's is sitelen pona only).
> - **Machine-checked guarantees** (`tests/path.test.ts`):
>   - units 1–14 introduce all 120 pu words plus the 3 synonyms exactly once
>   - every example, story line and phrase uses only words already taught
>   - everything passes the grammar linter
> - **Path map:** a winding road, with the vermilion current stop and inked completed stretches.
> - **Gating** (`src/engine/path.ts`): Learn introduces only the current unit's words, and only after its lesson is read. A unit completes when its checkpoint is passed (2/3) and 80% of its words have graduated in spaced repetition.
> - **Placement test:** adaptive, three questions per unit; skipped units' words go straight into review.
> - **New Dictionary tab:**
>   - search across Toki Pona, English glosses and compounds ("car" → `tomo tawa`)
>   - entries with examples, compounds and per-skill mastery
>   - a glyph book that inks in glyphs as you meet their words
>   - the phrasebook, unlocking along the path
> - **Navigation:** Learn / Practice / Dictionary.
>
> **Deviations:** the "graded readers" are the unit 15–16 checkpoint stories rather than a separate reader. There's one story per unit; a larger story library would be natural Phase 5 content.
> **Still open:** a fluent speaker should review the story texts (they're lint-clean and vocabulary-checked, but hand-written).

**Purpose:** a guided route from zero to reading.

**The path, *nasin*:** a winding road map. Each stop is a unit, and completing one reveals the next stretch of road and unlocks its glyphs in your *lipu* (glyph book).

| Unit | Theme | Grammar focus | Sample new words |
|---|---|---|---|
| 1 | **toki!** First words | `mi`/`sina` + predicate | mi sina pona ike toki jan |
| 2 | Things are… | `li` | ona ni soweli telo suli lili |
| 3 | Doing things | `e` | moku lukin jo pali kili pan |
| 4 | Building meaning | head-first modifiers, compounds | tomo tawa ilo kalama musi |
| 5 | No and maybe | `ala`, `X ala X`, `anu` | ala anu seme |
| 6 | Asking | `seme` in any slot | seme nimi |
| 7 | Where and how | prepositions | lon tawa tan sama kepeken |
| 8 | Wanting and being able | preverbs | wile ken kama awen sona open pini |
| 9 | Commands and calling | `o` | o |
| 10 | Grouping | `pi` | pi + revisit compounds |
| 11 | Time and context | `la`, `tenpo` | la tenpo sin pini |
| 12 | Counting | simple + pu numbers | wan tu luka mute ale nanpa |
| 13 | Names | unofficial words, the name adapter | ma toki jan + cartouches |
| 14 | Feelings and the body | review via `pilin`, body words | pilin olin lawa sijelo … |
| 15 | Reading sitelen pona | glyph-only sentences | — |
| 16 | Stories | short graded readers (3–8 sentences) | — |
| ★ | **Beyond pu** | ku suli words, community usage | kijetesantakalu tonsi monsuta … |

Remaining pu words are spread across units 2–14 by theme and frequency, so that all 120 are introduced by unit 14.

Each unit contains:
- a 1-screen **mini-lesson** (one idea, shown with glyphs and two examples)
- **3–5 practice sessions**
- a **checkpoint**: a short story or dialogue to read with comprehension questions

**Pathway features**
- **Placement test.** Experienced learners can skip ahead.
- **Unit review gates** use the SRS, not a pass mark: a unit is complete when its words reach a stability threshold.
- **Phrasebook** unlocks progressively (greetings, farewells, `moku pona`, `lape pona` …).
- **Dictionary screen:** search by Latin, English or glyph. It shows the concept, glosses, examples, compounds that use the word, and your mastery.

## Phase 5: Gameplay and delight *(medium)*: ✅ done 2026-11-20

> **Status:** a new **Play (musi)** section; the free-practice modes now live there too.
> - **Mastery garden** (`ma kasi`): one plant per learned word, drawn like the `kasi` glyph. Height follows FSRS stability, words held a month flower, and nothing wilts.
> - **Daily sentence:** the same all day, chosen from words you've met; also offered on the Learn home.
> - **Practice calendar:** four weeks of practice days, with no streak counter ("rest days are part of learning").
> - **Speed round** (`tenpo lili`): 60 seconds, keys 1–4, personal best, and missed words listed for review.
> - **nimi sina:** name adaptation as person, place or language, cartouche with letter key, audio, and a shareable PNG card (Web Share, or download).
> - **Compound puzzles** (`o nimi e ni`): 35 puzzles with multiple accepted answers, hints, and "Mine works too".
> - **Glyph tracing:** trace or from-memory modes; judged by a $P point-cloud recogniser against the font outlines. A pure SVG-path sampler means no DOM is needed, and drawn X / + / ○ are recognised in tests.
> - **Glyph book:** cards with the glyph drawn in, an example, and "Trace it".
> - **Saved progress:** game progress is stored with learning progress, so it's included in export and reset.
>
> **Deviations:** puzzles use an English prompt plus hint rather than drawn illustrations. Tracing accepts a drawing when the target is among the recogniser's top 3, since font outlines and hand-drawn centre-lines differ.
> **Still open:** illustrated puzzle prompts; a larger story library.

**Purpose:** reasons to come back that fit the *pona* spirit.

- **nimi sina.** Type your name, get 2–3 valid Toki Pona adaptations and its sitelen pona cartouche. Make it shareable as an image.
- **Compound puzzle ("o nimi e ni").** Shows an illustration (Phase 2 spots). The learner builds a 2–3 word description. Many answers are accepted, and the game shows how others would say it.
- **Glyph tracing.** Draw the sitelen pona on a canvas. Score against the stroke path (simple point-cloud matching, e.g. a $P-style recogniser).
- **Speed round, "tenpo lili".** 60 s rapid recognition with a personal best, and no global leaderboard.
- **Daily *toki*.** One short sentence a day to read, with a gentle calendar instead of a streak counter, and rest days allowed.
- **Glyph book completion.** Collect all 120 (+ku) glyphs. Each one has a tiny animation and its most "pona" example sentence.
- **Mastery garden (optional visual metaphor).** Each mastered word grows a `kasi` in a small generative garden. It's a calm, non-competitive progress display.

## Phase 6: Polish, quality and release *(small–medium)*: ✅ done 2026-11-20

> **Status:**
> - **Playwright e2e** (94 tests, desktop and mobile, run against the production build):
>   - the full unit-1 flow: lesson → session → checkpoint → reload
>   - every exercise type answered by keyboard, wrong-answer re-queueing, placement
>   - every game, dictionary search
>   - tests answer from the content files, never from hidden page data
> - **Accessibility:** an axe audit of 17 screens in light and dark finds 0 violations at any severity (fixed tab ARIA, an unlabelled file input, and locked-phrase contrast).
> - **Visual regression:** 24 snapshots with frozen time and seeded randomness.
> - **Lighthouse:** desktop 100 / 100 / 100 / 100 and mobile 98 / 100 / 100 / 100. Layout shift went from 0.557 to 0, by reserving the scrollbar gutter and holding the loading space.
> - **Build:** PNG and maskable icons plus an apple-touch icon, rendered from the pona glyph. A JS budget check (97 KB gz initial; Play and Dictionary lazy-loaded) runs in every build. Third-party notices are generated from shipped dependencies, and there's an About & credits dialog. robots.txt added.
> - **Bugs the e2e suite caught and fixed:**
>   - **Serious:** since Phase 4, reviews were limited to the current unit's words, so earlier units' words were never reviewed again. Covered now by a regression test.
>   - An Enter pressed within a frame of the feedback panel appearing was lost; shortcuts and focus now use layout effects.
>
> **Deferred:**
> - i18n-ready UI strings: a large refactor with no second language yet. Linku's multilingual definitions make it worthwhile later.
> - Screen-reader passes with VoiceOver and NVDA by a human (automated checks pass).
> - Choosing a hosting provider, and the project's own licence.

- E2E tests for every exercise and the full unit-1 flow. Visual regression snapshots.
- Performance budget: under 150 KB JS gzipped on initial load, and glyph and audio assets lazy-loaded per unit.
- Accessibility audit with VoiceOver and NVDA. Glyphs get `aria-label` with the Latin word, and Toki Pona text is marked `lang="tok"`.
- i18n-ready UI strings: Linku has definitions in many languages, so non-English glosses are a cheap later win.
- Credits and licences page (Sonja Lang/pu, ku, Linku, fonts, audio).
- Deploy as a static PWA (any static host). Hosting choice is deferred.

---

## Sequencing and dependencies

```
Phase 0 ──► Phase 1 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
              │                        ▲
              └──► Phase 2 ────────────┘   (2 can run in parallel with 3)
```

- **Phase 1 before anything big:** every later feature consumes the new data model.
- **Phase 2 and Phase 3 are independent** and can run in parallel.
- **Phase 4 needs both:** the engine for sessions, and visuals for the path and glyph book.
- **Quick-win option:** ship Phase 0 plus the 7 content fixes immediately, as a "v1.1" of the single file, before the restructure lands.

## Decisions needed

1. **Art direction:** the recommended "ink and paper" with sitelen pona, or keep and refine the retro-terminal DNA (VT323)?
2. **Framework:** Preact + Signals (recommended), or zero-dependency vanilla TS?
3. **Vocabulary scope:** pu only for the core path with ku suli as a bonus tier (recommended), or full Linku "common" set?
4. **Glyph source:** bundle an existing OFL sitelen pona font (fast), or commission and hand-draw single-stroke SVGs (beautiful animations, more work)? Recommended: font first, SVGs in Phase 2's second half.
5. **Audio:** Web Speech stopgap, record your own, or source community recordings (check licences)?
6. **`unpa` and sensitive content:** default-excluded from games (recommended)?
