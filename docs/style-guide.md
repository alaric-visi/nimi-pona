# Style guide: "ink and paper"

The interface should feel like the language: **simple, calm, good**. Warm paper, dark ink, one vermilion seal colour, and *sitelen pona* as the visual identity. Every value below is a token in [`src/ui/styles/tokens.css`](../src/ui/styles/tokens.css). Components never hard-code colours or durations.

## Colour

| token | light (paper) | dark (*tenpo pimeja*, night ink) | use |
|---|---|---|---|
| `--paper` | `#f4efe4` | `#12161f` | page background (with a fixed grain layer) |
| `--paper-raised` | `#fbf8f1` | `#1a1f2b` | cards, dialogs, buttons |
| `--paper-sunk` | `#ebe4d5` | `#0e1118` | segmented control track, notes |
| `--rule` / `--rule-strong` | `#d6cdbb` / `#b9ae98` | `#2c3343` / `#46506a` | borders, dividers |
| `--ink` / `--ink-soft` / `--ink-muted` | `#1d2433` / `#3f4657` / `#5d6372` | `#ece5d6` / `#cdc6b8` / `#a29d93` | text, from primary to tertiary (muted still passes AA on paper) |
| `--accent` (+ `-wash`) | `#b0412b` | `#e8927a` | the vermilion seal: brand mark, focus ring, streak, ku badge |
| `--good` / `--bad` (+ `-wash`) | `#2c6a43` / `#a3392a` | `#85c79a` / `#f0947f` | answer feedback only |

Rules:
- **One accent.** Vermilion is for identity and focus, not decoration. Green and red appear only as feedback.
- **Theme selection:** `prefers-color-scheme` by default. The Auto/Light/Dark button sets `data-theme` on `<html>`, and the browser `theme-color` follows it.

## Type

- **Toki Pona text** (anything with `lang="tok"`): Fraunces Variable with `SOFT 100`. It's a soft, slightly calligraphic serif that sits well beside the glyphs.
- **Interface text:** Atkinson Hyperlegible (400/700), chosen for legibility.
- **Scale:** `--step--1` 13px · `--step-0` 16px · `--step-1` 20px · `--step-2` 25.6px · `--step-word` 52–88px fluid.
- **Labels** use small caps style: uppercase, 0.75rem, 0.08em tracking, `--ink-muted`.

## sitelen pona

- **Source:** glyph outlines come from *nasin nanpa* 4.0.2 by jan Itan (MIT). `npm run build:glyphs` extracts them into `src/data/glyphs.json` as SVG path data. The app ships no glyph font.
- **Frame:** every glyph shares one frame (`GLYPH_FRAME`, a full em by the overall ink extent), so glyphs keep their designed relative sizes. Never crop an individual glyph to its own box.
- **Colour:** glyphs use `currentColor`. They take the colour of their context.
- **Where glyphs appear:**

  | Where | Size |
  |---|---|
  | card hero | 92–136px; 120–176px in glyph-only mode |
  | answer line | 30px beside the Latin word |
  | sentence lines | 22px |
  | cartouches | 16px |
  | topic chips | 15px |
  | the header seal | in the vermilion seal |
  | the done screen | 72px, in `--accent` |
  | the app icon | in the vermilion tile |
- **Names** are written in a **cartouche** (a rounded outline), spelled letter by letter with the glyphs in `CARTOUCHE_LETTERS` (acrophony, as described in pu).
- **Writing setting:** glyph + Latin (default), glyphs only (reading practice; the answer side always shows Latin), or Latin only.
- **Accessibility:** glyphs are decorative (`aria-hidden`) wherever the Latin word is present. Glyph-only prompts get an explicit label instead.

## Shape, space, depth

- **Radii:** `--radius-sm` 8 · `--radius` 14 (buttons, options) · `--radius-lg` 22 (cards, dialog). Chips and pills are fully round.
- **Layout:** the column is 680px max with a 16px gutter. Touch targets are at least 40px (chips 34px with spacing).
- **Depth:** `--shadow-card` is a soft three-layer shadow (warm-tinted in light, plain in dark). Cards are the only elevated surface besides the dialog.
- **Paper grain:** a fixed SVG-noise layer (`--grain-opacity` 0.45 light, 0.12 dark). It never catches input.

## Motion

| token | value | used for |
|---|---|---|
| `--dur-fast` | 120ms | hovers, presses |
| `--dur` | 220ms | state changes, panels rising |
| `--dur-reveal` | 620ms | the ink reveal of a card's answer |
| `--dur-draw` | 900ms | tracing a glyph outline (1400ms when re-drawn after a wrong answer) |
| `--dur-ink` | 450ms | the fill soaking into a traced glyph |

Easing: `--ease-out` for things arriving, `--ease-in-out` for things that travel.

Signature motions:
- **Ink reveal.** The answer face spreads out as a circle from the exact point the card was touched (`--ink-x/--ink-y`), and the front recedes. It replaces the 3D flip. Each card is a fresh element, so a reveal never animates shut over the next card's answer.
- **Glyph drawing.** The outline is traced (`stroke-dashoffset` with `pathLength=1`), then the fill soaks in and the stroke dissolves.
- **Feedback:**
  - correct: the glyph blooms (a slight scale and a soft green glow)
  - wrong: the chosen option nudges sideways and the glyph is traced again, slowly
- **Tilt.** Cards lean up to 3.5° toward the mouse, on fine pointers only.

**Reduced motion** sets every duration to 0. The reveal becomes an instant swap, glyphs appear fully inked, and the bloom, nudge and tilt are off.

## Sound

Off by default. Soft tones are synthesised with Web Audio (no files): a sine with a quiet octave and a fast decay, on a D-major pentatonic so any two cues sound consonant. Two rising notes for correct, one low note for wrong, a three-note arpeggio for round complete.

## Voice

- **Toki Pona first, English second:**
  - `pona!` / `ike…` as feedback headings
  - `o musi sin!` on the replay button
- **Encouraging, never scolding.** There is no failure state, only "keep going".
