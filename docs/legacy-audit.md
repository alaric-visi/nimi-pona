# Audit of the legacy build (`legacy/index.html`)

This is a snapshot of the single-file app as received, kept unchanged in `legacy/` for reference.
These findings feed directly into Phases 0 and 1 of [`PLAN.md`](../PLAN.md).

## 1. Vocabulary coverage

- **121 entries**: all 120 *nimi pu* (the 120 words in Sonja Lang's *Toki Pona: The Language of Good*, 2014) plus `oko`. Checked by script against the pu list.
- **Inconsistency:** `oko` is included, but pu lists three synonym spellings together: **`oko`** (for `lukin`), **`kin`** (for `a`), **`namako`** (for `sin`). Either include all three, flagged as synonyms, or none. The footer says "120 nimi pu", but the deck has 121.
- `ale` has the common variant **`ali`**, which isn't mentioned. Learners will see both.
- There is no data beyond pu. Words that the community commonly uses (from *ku*, 2021, and the Linku dictionary), such as `kijetesantakalu`, `tonsi`, `monsuta`, `leko`, `kipisi`, `misikeke`, `n` and `su`, are absent. That's fine for v1, but the data model should be able to take them.

## 2. Example-sentence errors (language correctness)

| word | current example | problem | suggested |
|---|---|---|---|
| `ala` | `mi ala sona e ni.` | `ala` follows the word it negates. As written, this reads as "not-me knows…". | `mi sona ala e ni.` |
| `insa` | `insa pi tomo li lete.` | `pi` needs **two or more** words after it. Using it with one word is a classic learner error. | `insa tomo li lete.` |
| `utala` | `utala ala, pona tawa!` | This doesn't parse and has no clear meaning. | `o utala ala!` ("don't fight!") |
| `unpa` | `—` | Has no example. Needs a content policy (see Phase 1). | Hide by default, or add a neutral example behind a setting |
| `pu` | `mi pu.` | Grammatical but opaque to a learner. | `jan li pu.` + explain "has read / interacts with *pu*" |
| `len` | `len li lete ala e mi.` | Grammatical but stilted ("cloth does not make me cold"). | `mi jo e len lete.` |
| `sewi` | `sewi li suno.` | Ambiguous: "the sky shines" or "the divine is sun". | `waso li lon sewi.` |

None of the examples have **English translations**, which is the biggest pedagogical gap.

## 3. Data-model problems

- **`pos` uses English parts of speech** (`vt`, `mod`, `n/v`). Toki Pona words are role-flexible: almost any content word can be a noun, verb or modifier depending on position. pu groups words by *function* (particle, preverb, preposition, content word). Teaching English POS reinforces the wrong mental model.
- **Categories are ad hoc.** `particle` (27 entries) mixes true particles (`li e la pi o`), pronouns (`mi sina ona`), numbers (`wan tu`), preverbs (`ken wile`) and question words (`seme`). Grammar function and semantic theme should be **separate axes**.
- **One gloss string per word.** A Toki Pona word covers a *semantic space*, not one English word. The quiz needs a list of acceptable meanings, a "core" gloss for display and notes.
- **No IDs, no frequency/usage data, no sitelen pona glyph, no audio, no lesson membership.**

## 4. Functional bugs

1. **Wrong answers highlight three options green.** After a wrong answer in the quiz, `checkQuiz` adds `correct-ans` to *every* non-wrong button, not only the correct one.
2. **Done-screen newlines collapse.** Messages use `\n` in `textContent`, but `.done-msg` has no `white-space: pre-line`.
3. **Score is unfair in Flash mode.** `NEXT CARD` advances without marking. Skipped cards still count in the denominator (`correct / deck.length`), so skipping lowers the score.
4. **Redundant controls.** After a flip, GOT IT, MISSED and NEXT all appear. NEXT bypasses self-grading.
5. **Flip race.** `flipCard` shows the action buttons via a 300 ms `setTimeout` that never gets cancelled. Flip → unflip within 300 ms leaves the buttons visible on an unflipped card.
6. **Quiz distractors are unfiltered.** They can be near-synonyms (`lukin` with `oko` "eye") or the same word's variant, which creates questions with two correct answers.
7. **Quiz auto-advances after 1.5 s.** There's no time to read the right answer or the example, and no way to pause.
8. **Stats reset on every mode or category change.** Nothing persists between sessions.

## 5. Technical / UX debt

- `html, body { overflow: hidden }` + `height: 100vh` clips content on small phones and under mobile browser chrome. Use `100dvh` and allow scroll.
- **Theme sync reaches into `window.parent.document`.** That throws cross-origin, which is caught. In standalone mode, dark detection runs once and never listens for changes. Light mode is the implicit default (`html:not(.dark)`) even though `:root` declares dark tokens, which makes the token logic inverted and confusing.
- Inline `onclick=` handlers + global mutable state + `getElementById` everywhere. Content swaps use inline `style.fontSize` instead of classes.
- **No keyboard support** (space to flip, 1–4 to answer, arrows) and **no ARIA**. The flip card is a `div` with a click handler, so it isn't focusable, and screen readers can't tell which face is visible.
- `prefers-reduced-motion` isn't respected.
- Footer colour `#444` is hard-coded, so contrast fails in dark mode.
- Unused CSS (`.title`, `.subtitle`, `.card-meaning` always empty). The header's left `<div>` is empty, so the app has no visible name.
- Google Fonts is fetched at runtime, so the app has no offline capability.
- VT323 and Share Tech Mono are display choices with no connection to Toki Pona. The language has its own native script (*sitelen pona*), which isn't used at all.
