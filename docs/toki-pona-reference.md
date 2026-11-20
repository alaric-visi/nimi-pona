# Toki Pona: language reference for this project

This is a working reference for anyone building content or features. It covers the language facts the app must get right and what each one implies for design.
Items marked **[verify]** are details to confirm against the primary source before shipping: licences and exact lists change.

---

## 1. Background

- **Created by Sonja Lang** (earlier Sonja Elen Kisa). It was first published online in 2001 and is inspired by Taoist ideas of simplicity and minimalism.
- ***pu*** (2014, *Toki Pona: The Language of Good*) is the official book. It defines **120 words** plus 3 synonym spellings (`kin`=`a`, `namako`=`sin`, `oko`=`lukin`), the grammar and *sitelen pona*.
- ***ku*** (2021, *Toki Pona Dictionary*) records how words are actually used, from a large community survey. Its "ku suli" set adds about 17 commonly used words, e.g. `kijetesantakalu`, `tonsi`, `monsuta`, `leko`, `kipisi`, `misikeke`, `soko`, `epiku`, `jasima`, `lanpan`, `linluwi`, `majuna`, `meso`, `n`, `su`, `ku`. **[verify exact list]**
- **Linku** (linku.la, data in the `lipu-linku` GitHub org) is the community dictionary. It has **usage categories** (core / common / uncommon / obscure / sandbox), definitions in many languages, glyph info and audio. **This is the best upstream data source for the app.** **[verify licence, believed CC BY-SA 4.0]**
- **ISO 639-3 code: `tok`** (assigned 2022). Use `lang="tok"` on Toki Pona text in the HTML.
- **Community culture:** names are written `jan Name`, and the community greeting is `toki!`. Learners will meet jan Misali's video course, *o kama sona e toki pona!* (jan Lope), *lipu tenpo* (a magazine) and *ma pona pi toki pona* (Discord). Pointing to these from the app is good practice.

## 2. Sounds and spelling (*phonology & phonotactics*)

- **14 phonemes.** Consonants: `p t k s m n l j w`. Vowels: `a e i o u`.
  - `j` = English "y" (*jan* ≈ "yahn"). Vowels are pure, as in Spanish or Italian.
- **Syllables are (C)V(n).** A syllable-final `n` is the only coda.
- **Forbidden sequences:** `ji`, `ti`, `wo`, `wu`, `nn`, `nm`. A vowel may start a word but never a mid-word syllable.
- **Stress is always on the first syllable.**
- Official words are **always lower case**. Capital letters mark **unofficial words** (names: `ma Kanata`, `toki Inli`, `jan Sonja`).

**Implications for the app**
- A ~30-line **phonotactics validator** can check every word, name and user answer in the content. It runs at build time as a content lint.
- **Pronunciation audio, cheaply:** Toki Pona sounds are close to Spanish or Italian. The Web Speech API with an `es-ES` or `it-IT` voice is an acceptable interim reader. Swap in human recordings (Linku has some, **[verify licence]**) later.
- **Name game:** adapting a name to Toki Pona phonotactics is a classic, fun exercise (see §6).

## 3. Grammar essentials (the learning-path backbone)

| # | Concept | Pattern | Example |
|---|---|---|---|
| 1 | Bare predicate with `mi` / `sina` | `mi/sina` + predicate (no `li`) | `mi pona.`, "I'm good." |
| 2 | `li` separates subject and predicate (all other subjects) | S `li` P | `soweli li suwi.` |
| 3 | `e` marks the direct object | S `li` V `e` O | `jan li moku e kili.` |
| 4 | **Head-first modifiers.** The first word is the head; later words narrow it. | N + mod + mod | `jan pona` friend · `tomo tawa` car · `telo nasa` alcohol · `jan lili` child |
| 5 | Negation: `ala` after the word | V `ala` | `mi sona ala.` |
| 6 | Yes/no questions: `X ala X` or `… anu seme?` | | `sina pona ala pona?` · answer `pona` / `pona ala` (no word for "yes") |
| 7 | Question word `seme` goes in the slot of the unknown | | `sina moku e seme?` |
| 8 | Prepositions: `lon tawa tan sama kepeken` | P + phrase | `mi lon tomo.` |
| 9 | Preverbs: `wile sona awen kama ken lukin` (+ `open pini` in common usage) | preverb + V | `mi wile moku.` |
| 10 | `o`: commands and addressing someone | `o` V / `X o, …` | `o kama!` · `jan Lisa o, toki!` |
| 11 | `pi`: regroups a **2+ word** modifier | N `pi` mod mod | `jan pi toki pona` "Toki Pona speaker" ≠ `jan toki pona` |
| 12 | `la`: context / condition / time | context `la` sentence | `tenpo pimeja la mi lape.` |
| 13 | Multiple predicates / objects | repeat `li`, repeat `e` | `mi moku e pan e kili.` |
| 14 | `en` joins **subjects only** | | `mi en sina li toki.` |
| 15 | Numbers | simple: `wan tu mute ale` · pu: `wan`1 `tu`2 `luka`5 `mute`20 `ale`100, additive | `mute luka tu wan` = 28 |
| 16 | Unofficial words / names | `jan Name`, `ma Name`, `toki Name` | `mi jan Kalina.` |

**Classic learner errors.** These make great "spot the mistake" items:
`mi li pona` (no `li` after bare `mi`) · `jan pi suli` (`pi` + one word) · `mi ala moku` (`ala` misplaced) · `mi en sina` used for "I and you eat X" objects · `soweli li pona e mi` vs `soweli li pona tawa mi` (cause vs opinion) · forgetting `e`.

## 4. Meaning: semantic spaces, not glosses

The central idea learners must absorb: **a Toki Pona word names a *concept*, and context picks the English translation.**
- `moku` covers eat, drink and food. `pona` covers good, simple, fix, thanks. `tawa` covers go, movement, toward, and "for/to (someone's opinion)".
- Compounds are descriptive, not fixed vocabulary: a car can be `tomo tawa`, `ilo tawa` or `tomo tawa ma`. **Several answers can be right.**

**Implications for the app**
- Each word stores a **core concept line**, **multiple accepted glosses** and **typical roles** (content word / particle / preverb / preposition), not English POS.
- Grading for English→Toki Pona and description tasks must accept **sets** of answers, and should tell the learner "also acceptable: …".
- Teach compounds as **puzzles** ("describe this picture with 2–3 words"), not as a word list.
- Quiz distractors must avoid **semantic neighbours**. Tag synonym and near-synonym groups (`lukin`/`oko`, `ale`/`ali`, `a`/`kin`, `sin`/`namako`, `ijo`/`ni` contexts).

## 5. Writing systems

- **sitelen Lasina**: Latin letters (what the legacy app uses).
- **sitelen pona**: the logographic script from pu. Each word is a simple glyph, and modifiers can stack or nest. Names are written in a **cartouche** (a rounded box) using glyphs whose words start with each sound (acrophony): e.g. `ma Kanata` → [kala alasa nasin awen telo alasa]. Many learners find this the most charming part of the language.
- **UCSUR** (the Under-ConScript Unicode Registry, for private-use scripts) assigns sitelen pona **U+F1900–U+F19FF**, with cartouche start and end at **U+F1990/U+F1991**. **[verify]**
- **Fonts:** *linja pona* (jan Same, the most widely used, with Latin-to-glyph ligatures), *nasin nanpa*, *linja sike*, *Fairfax HD*. **[verify each licence before bundling; prefer an OFL font]**
- **sitelen sitelen** (Jonathan Gabel) is an elaborate, artistic script. It could be a late-game Easter egg; don't teach it.

**Implications:** sitelen pona should be the app's **visual identity**: card hero, unlockables, a reading mode. Stroke-animated glyph SVGs make an ideal reveal animation.

## 6. Proper-name adaptation (algorithm sketch for the "nimi sina" game)

1. Transcribe the name by **sound** (not spelling) into the 14 phonemes: `r`→`l`, `b`→`p`, `d`→`t`, `g`→`k`, `f/v`→`p` or `w`, `z/sh/ch/th`→`s` (or `t`), `y`→`j`.
2. Break it into (C)V(n) syllables. Insert vowels to break consonant clusters or delete consonants (usually `u`/`i`/`e`, chosen by feel).
3. Repair forbidden sequences: `ti`→`si`, `ji`→`i`/`li`, `wo`→`o`, `wu`→`u`, `nm`/`nn`→`m`/`n`.
4. Capitalise, and prefix with `jan` / `ma` / `toki`.
Examples (community-standard): Canada → `ma Kanata`, English → `toki Inli`, America → `ma Mewika`.
Multiple valid outputs exist, so present 2–3 options and let the learner pick.

## 7. Everyday phrases (good early "reward" content)

| phrase | meaning |
|---|---|
| `toki!` | hello |
| `sina pona anu seme?` | how are you? |
| `mi pona.` | I'm good |
| `pona!` / `pona tawa sina` | thanks / good to you |
| `kama pona!` | welcome |
| `tawa pona!` | goodbye (to someone leaving) |
| `awen pona!` | goodbye (to someone staying) |
| `lape pona!` | good night |
| `moku pona!` | enjoy your meal |
| `mi pakala.` | sorry / oops |
| `nimi mi li …` / `mi jan …` | my name is … |
| `sina sona ala sona e toki pona?` | do you know Toki Pona? |

## 8. Content policy notes

- `unpa` (sex) and `jaki` / `moli` themes are standard pu vocabulary. Recommendation: include `unpa` in the dictionary view, but **exclude it from games by default**, with a setting to include it. Write examples that are neutral and non-explicit.
- Avoid gendered defaults: `jan` is gender-neutral, and `meli` / `mije` are optional. Pronouns `ona` = he / she / it / they.
- Credit sources visibly: Sonja Lang / pu, ku, Linku, and any font and audio authors.
