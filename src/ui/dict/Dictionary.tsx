import { useEffect, useMemo, useRef } from 'preact/hooks';
import { openPlay } from '../../app/play';
import { signal } from '@preact/signals';
import { ROLE_LABEL, type Word } from '../../data/words';
import { examplesFor } from '../../data/sentences';
import { COMPOUNDS, PHRASES, UNIT_OF_WORD, compoundsWith } from '../../data/path';
import { actions, hiddenWords, pool, settings } from '../../app/store';
import { current, learnActions, srs } from '../../app/learn';
import { cardId, isLearned, retrievability, SKILLS, type Skill } from '../../engine/srs';
import { normaliseTok } from '../../engine/answers';
import { Glyph, SitelenText } from '../components/Glyph';
import { SpeakLine } from '../learn/UnitView';

type Tab = 'words' | 'glyphs' | 'phrases';
const tab = signal<Tab>('words');
const query = signal('');
const openWord = signal<string | null>(null);
const glyphCard = signal<string | null>(null);

/** A glyph book card: the glyph inks itself in, with its meaning and a sentence. */
function GlyphCard() {
  const id = glyphCard.value;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (id && !d.open) d.showModal();
    if (!id && d.open) d.close();
  }, [id]);
  const w = id ? pool.value.find((x) => x.id === id) : undefined;
  const ex = w ? examplesFor(w.id, 1, { excludeWords: hiddenWords.value })[0] : undefined;
  const close = () => (glyphCard.value = null);
  return (
    <dialog ref={ref} class="dialog glyph-dialog" aria-label={w ? `Glyph: ${w.id}` : 'Glyph'} onClose={close} onClick={(e) => e.target === ref.current && close()}>
      {w && (
        <div class="dialog-body glyph-card">
          <Glyph key={w.id} name={w.glyph} draw class="glyph-card-glyph" />
          <p class="glyph-card-word" lang="tok">
            {w.id}
          </p>
          <p class="entry-concept">{w.concept}</p>
          {ex && (
            <p class="glyph-card-ex">
              <SitelenText text={ex.tok} />
              <span lang="tok">{ex.tok}</span>
              <span class="lesson-example-en">{ex.en}</span>
            </p>
          )}
          <div class="progress-actions">
            <button
              type="button"
              class="btn"
              onClick={() => {
                close();
                actions.setMode('play');
                openPlay({ kind: 'trace', word: w.id });
              }}
            >
              Trace it
            </button>
            <button
              type="button"
              class="btn"
              onClick={() => {
                close();
                query.value = w.id;
                openWord.value = w.id;
                tab.value = 'words';
              }}
            >
              Full entry
            </button>
            <button type="button" class="btn btn-primary" onClick={close}>
              Close
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

const SKILL_NAME: Record<Skill, string> = { recognise: 'meaning', recall: 'recall', glyph: 'sitelen pona', listen: 'listening' };

/** Words that appear in a compound whose English contains `term` as a whole word. */
function compoundHits(term: string): Set<string> {
  const hits = new Set<string>();
  for (const c of COMPOUNDS) {
    if (c.en.toLowerCase().split(/[^a-z]+/).includes(term)) for (const w of c.tok.split(' ')) hits.add(w);
  }
  return hits;
}

/**
 * Rank matches: exact word, word prefix, spelling variant, whole-word gloss,
 * compound ("car" → tomo tawa), then gloss-word prefix and concept text.
 */
export function search(words: readonly Word[], q: string): Word[] {
  const n = q.trim().toLowerCase();
  if (!n) return [...words].sort((a, b) => a.id.localeCompare(b.id));
  const tp = normaliseTok(n);
  const viaCompound = compoundHits(n);
  const glossWords = (w: Word) => w.glosses.flatMap((g) => g.toLowerCase().split(/[^a-z-]+/));
  const scored = words
    .map((w) => {
      let score = -1;
      if (w.id === tp) score = 100;
      else if (tp && w.id.startsWith(tp)) score = 80;
      else if (w.variants?.includes(tp)) score = 75;
      else if (w.glosses.some((g) => g.toLowerCase() === n)) score = 60;
      else if (glossWords(w).includes(n)) score = 50;
      else if (viaCompound.has(w.id)) score = 45;
      else if (n.length >= 3 && glossWords(w).some((g) => g.startsWith(n))) score = 30;
      else if (n.length >= 3 && w.concept.toLowerCase().split(/[^a-z-]+/).some((c) => c.startsWith(n))) score = 20;
      return { w, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.w.id.localeCompare(b.w.id));
  return scored.map((x) => x.w);
}

function skillState(wordId: string, skill: Skill): 'none' | 'learning' | 'learned' {
  const card = srs.value.cards[cardId(wordId, skill)];
  return !card ? 'none' : isLearned(card) ? 'learned' : 'learning';
}

function MasteryDots({ w }: { w: Word }) {
  return (
    <span class="mastery-dots" aria-hidden="true">
      {SKILLS.map((s) => (
        <span key={s} class={`dot is-${skillState(w.id, s)}`} title={SKILL_NAME[s]} />
      ))}
    </span>
  );
}

function Entry({ w }: { w: Word }) {
  const unit = UNIT_OF_WORD.get(w.id);
  const examples = examplesFor(w.id, 4, { excludeWords: hiddenWords.value });
  const compounds = compoundsWith(w.id);
  const now = new Date();
  return (
    <div class="entry-body">
      <p class="entry-concept">{w.concept}</p>
      <p class="entry-meta">
        <span>{w.roles.map((r) => ROLE_LABEL[r]).join(' / ')}</span> · <span>{w.themes.join(', ')}</span>
        {w.variants && <> · also spelled <span lang="tok">{w.variants.join(', ')}</span></>}
        {w.synonyms && <> · same as <span lang="tok">{w.synonyms.join(', ')}</span></>}
      </p>
      <p class="entry-glosses">
        <span class="card-small-label">translations</span> {w.glosses.join(', ')}
      </p>
      {w.notes && <p class="card-note">{w.notes}</p>}

      {examples.length > 0 && (
        <ul class="entry-examples">
          {examples.map((s) => (
            <li key={s.tok}>
              {settings.value.script !== 'latin' && <SitelenText text={s.tok} />}
              <span class="lesson-example-tok">
                <span lang="tok">{s.tok}</span>
                <SpeakLine text={s.tok} />
              </span>
              <span class="lesson-example-en">{s.en}</span>
            </li>
          ))}
        </ul>
      )}

      {compounds.length > 0 && (
        <p class="entry-compounds">
          <span class="card-small-label">compounds</span>{' '}
          {compounds.map((c, i) => (
            <span key={c.tok}>
              {i > 0 && ' · '}
              <span lang="tok">{c.tok}</span> <span class="entry-compound-en">{c.en}</span>
            </span>
          ))}
        </p>
      )}

      <dl class="entry-skills">
        {SKILLS.map((s) => {
          const card = srs.value.cards[cardId(w.id, s)];
          const state = skillState(w.id, s);
          return (
            <div key={s} class={`is-${state}`}>
              <dt>{SKILL_NAME[s]}</dt>
              <dd>
                {state === 'none' ? 'not started' : state === 'learned' ? `learned · ${Math.round(retrievability(card!, now) * 100)}% recall` : 'learning'}
              </dd>
            </div>
          );
        })}
      </dl>

      {unit && (
        <button
          type="button"
          class="link-btn"
          onClick={() => {
            actions.setMode('learn');
            learnActions.open({ kind: 'unit', id: unit.id });
          }}
        >
          Taught in {unit.optional ? 'the bonus unit' : `unit ${unit.n}`}: {unit.title} →
        </button>
      )}
    </div>
  );
}

function WordsTab() {
  const results = useMemo(() => search(pool.value, query.value), [query.value, pool.value]);
  return (
    <>
      <label class="search">
        <span class="visually-hidden">Search words</span>
        <input
          type="search"
          class="typed-input search-input"
          placeholder="Search toki pona or English…"
          value={query.value}
          onInput={(e) => (query.value = e.currentTarget.value)}
          autocomplete="off"
          spellcheck={false}
        />
      </label>
      <p class="search-count" role="status">
        {results.length} {results.length === 1 ? 'word' : 'words'}
      </p>
      <ul class="entries">
        {results.map((w) => (
          <li key={w.id}>
            <details
              class="entry"
              open={openWord.value === w.id}
              onToggle={(e) => {
                const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                if (isOpen) openWord.value = w.id;
                else if (openWord.value === w.id) openWord.value = null;
              }}
            >
              <summary class="entry-row">
                {settings.value.script !== 'latin' && <Glyph name={w.glyph} class="entry-glyph" />}
                <span class="entry-word" lang="tok">
                  {w.id}
                </span>
                <span class="entry-short">{w.concept}</span>
                <MasteryDots w={w} />
              </summary>
              {openWord.value === w.id && <Entry w={w} />}
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}

function GlyphsTab() {
  const words = [...pool.value].sort((a, b) => a.id.localeCompare(b.id));
  const met = words.filter((w) => srs.value.cards[cardId(w.id, 'recognise')]).length;
  return (
    <>
      <p class="search-count">
        <span lang="tok">lipu sitelen</span> — your glyph book: {met} of {words.length} glyphs collected. Glyphs ink in as
        you meet their words.
      </p>
      <ul class="glyph-book">
        {words.map((w) => {
          const known = !!srs.value.cards[cardId(w.id, 'recognise')];
          return (
            <li key={w.id}>
              <button
                type="button"
                class={`glyph-cell ${known ? 'is-known' : ''}`}
                onClick={() => (glyphCard.value = w.id)}
                aria-label={`${w.id}${known ? '' : ' (not met yet)'}`}
              >
                <Glyph name={w.glyph} class="glyph-cell-glyph" />
                <span lang="tok" class="glyph-cell-word">
                  {w.id}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function PhrasesTab() {
  const reached = current.value?.n ?? 99;
  return (
    <ul class="phrase-book">
      {PHRASES.map((p) => {
        const open = p.unit <= reached;
        return (
          <li key={p.tok} class={open ? '' : 'is-locked'}>
            {settings.value.script !== 'latin' && open && <SitelenText text={p.tok} />}
            <span class="lesson-example-tok">
              <span lang="tok">{open ? p.tok : '· · ·'}</span>
              {open && <SpeakLine text={p.tok} />}
            </span>
            <span class="lesson-example-en">
              {p.en}
              {!open && <span class="phrase-lock"> — unlocks in unit {p.unit}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Dictionary() {
  return (
    <section class="dictionary" aria-label="Dictionary">
      <div class="segmented segmented-3" role="tablist" aria-label="Dictionary view">
        {(
          [
            ['words', 'Words'],
            ['glyphs', 'Glyph book'],
            ['phrases', 'Phrases'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            class="segment"
            aria-selected={tab.value === id}
            onClick={() => (tab.value = id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab.value === 'words' ? <WordsTab /> : tab.value === 'glyphs' ? <GlyphsTab /> : <PhrasesTab />}
      <GlyphCard />
    </section>
  );
}
