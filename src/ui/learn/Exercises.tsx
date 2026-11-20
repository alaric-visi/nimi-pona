import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Exercise } from '../../engine/exercises';
import { Rating, type Grade } from '../../engine/srs';
import { learnActions, live, voiceAvailable } from '../../app/learn';
import { settings } from '../../app/store';
import { speak } from '../../app/speech';
import { Glyph, SitelenText } from '../components/Glyph';
import { Examples, Glosses, Meta, Note, WordHero, WordLine } from '../components/WordBits';
import { digit, useKeys } from './useKeys';

type Of<T extends Exercise['type']> = Extract<Exercise, { type: T }>;

const answered = () => !!live.value?.result;
const respond = learnActions.respond;

/** Prompt card shared by every exercise; focused when a new exercise appears. */
function Prompt({ label, children, tone }: { label: string; children: ComponentChildren; tone?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const a = document.activeElement;
    if (!a || a === document.body || a.closest('.stage, .feedback')) ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div class={`card card-static learn-prompt ${tone ?? ''}`} ref={ref} tabIndex={-1} aria-label={label}>
      <span class="card-face">
        <span class="card-label">{label}</span>
        {children}
      </span>
    </div>
  );
}

function SpeakButton({ text, auto = false }: { text: string; auto?: boolean }) {
  useEffect(() => {
    if (auto && voiceAvailable()) speak(text);
  }, [text]);
  if (!voiceAvailable()) return null;
  return (
    <button type="button" class="icon-btn speak-btn" onClick={() => speak(text)} aria-label="Play pronunciation">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
      </svg>
      <span class="icon-btn-label">Listen</span>
    </button>
  );
}

/** Numbered options with the usual right / wrong / dim states once answered. */
function Options<T>({
  items,
  isAnswer,
  idOf,
  chosen,
  render,
  label,
  grid = true,
}: {
  items: T[];
  isAnswer: (x: T) => boolean;
  idOf: (x: T) => string;
  chosen: string | null;
  render: (x: T, i: number) => ComponentChildren;
  label: (x: T, i: number) => string | undefined;
  grid?: boolean;
}) {
  const done = answered();
  useKeys((e) => {
    const i = digit(e);
    if (done || i < 0 || i >= items.length) return false;
    respond({ kind: 'option', id: idOf(items[i]) });
    return true;
  });
  return (
    <ol class={`options ${grid ? '' : 'options-row'}`} aria-label="Choices">
      {items.map((x, i) => {
        const state = !done ? '' : isAnswer(x) ? 'is-correct' : idOf(x) === chosen ? 'is-wrong' : 'is-dim';
        return (
          <li key={idOf(x)}>
            <button
              type="button"
              class={`option ${state}`}
              disabled={done}
              aria-label={label(x, i)}
              onClick={() => respond({ kind: 'option', id: idOf(x) })}
            >
              <kbd aria-hidden="true">{i + 1}</kbd>
              <span class="option-text">{render(x, i)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const chosenId = () => {
  const r = live.value?.response;
  return r?.kind === 'option' ? r.id : null;
};

// ── introduction ─────────────────────────────────────────────────────────────

export function IntroEx({ ex }: { ex: Of<'intro'> }) {
  const w = ex.word;
  const script = settings.value.script;
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus({ preventScroll: true }), [w.id]);
  return (
    <div class="stage">
      <div class="card card-static learn-prompt learn-intro">
        <span class="card-face">
          <span class="card-label card-label-accent">nimi sin · new word</span>
          <WordHero w={w} script={script === 'glyphs' ? 'both' : script} drawKey={`intro-${w.id}`} />
          <SpeakButton text={w.id} auto />
          <span class="card-gloss card-gloss-lg">{w.concept}</span>
          <Glosses w={w} />
          <Meta w={w} />
          <Examples w={w} />
          <Note w={w} />
        </span>
      </div>
      <button ref={btn} type="button" class="btn btn-primary" onClick={learnActions.next}>
        Got it <kbd aria-hidden="true">enter</kbd>
      </button>
    </div>
  );
}

// ── multiple choice: meaning, or the word for a meaning ──────────────────────

export function ChoiceEx({ ex }: { ex: Of<'choice'> }) {
  const script = settings.value.script;
  const tpEn = ex.direction === 'tp-en';
  return (
    <div class="stage">
      <Prompt label={tpEn ? 'What does this mean?' : 'Which word means this?'}>
        {tpEn ? (
          <WordHero w={ex.word} script={script} drawKey={`c-${ex.word.id}`} />
        ) : (
          <span class="card-gloss card-gloss-lg">{ex.word.concept}</span>
        )}
      </Prompt>
      <Options
        items={ex.options}
        idOf={(o) => o.id}
        isAnswer={(o) => o.id === ex.word.id}
        chosen={chosenId()}
        label={() => undefined}
        render={(o) =>
          tpEn ? (
            o.concept
          ) : (
            <span class="option-word">
              {script !== 'latin' && <Glyph name={o.glyph} class="option-glyph-sm" />}
              <span lang="tok">{o.id}</span>
            </span>
          )
        }
      />
    </div>
  );
}

// ── sitelen pona ↔ word ──────────────────────────────────────────────────────

export function GlyphEx({ ex }: { ex: Of<'glyph'> }) {
  const toWord = ex.direction === 'glyph-word';
  return (
    <div class="stage">
      <Prompt label={toWord ? 'Which word is this glyph?' : 'Which glyph is this word?'}>
        {toWord ? (
          <Glyph key={ex.word.id} name={ex.word.glyph} draw class="hero-glyph" />
        ) : (
          <span class="card-word" lang="tok">
            {ex.word.id}
          </span>
        )}
      </Prompt>
      <Options
        items={ex.options}
        idOf={(o) => o.id}
        isAnswer={(o) => o.id === ex.word.id}
        chosen={chosenId()}
        grid={toWord}
        label={(o, i) => (toWord ? undefined : answered() ? `Glyph for ${o.id}` : `Glyph option ${i + 1}`)}
        render={(o) =>
          toWord ? (
            <span lang="tok">{o.id}</span>
          ) : (
            <Glyph name={o.glyph} class="option-glyph" />
          )
        }
      />
    </div>
  );
}

// ── typed recall & listening ─────────────────────────────────────────────────

function TypedAnswer({ placeholder }: { placeholder: string }) {
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const done = answered();
  useEffect(() => input.current?.focus({ preventScroll: true }), []);
  return (
    <form
      class="typed"
      onSubmit={(e) => {
        e.preventDefault();
        if (!done) respond({ kind: 'text', value });
      }}
    >
      <input
        ref={input}
        class="typed-input"
        lang="tok"
        value={value}
        onInput={(e) => setValue(e.currentTarget.value)}
        placeholder={placeholder}
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        disabled={done}
        aria-label="Your answer"
      />
      <div class="typed-actions">
        <button type="button" class="btn" disabled={done} onClick={() => respond({ kind: 'text', value: '' })}>
          I don't know
        </button>
        <button type="submit" class="btn btn-primary" disabled={done || !value.trim()}>
          Check <kbd aria-hidden="true">enter</kbd>
        </button>
      </div>
    </form>
  );
}

export function TypedEx({ ex }: { ex: Of<'typed'> }) {
  return (
    <div class="stage">
      <Prompt label="Type the toki pona word">
        <span class="card-gloss card-gloss-lg">{ex.word.concept}</span>
        <Meta w={ex.word} />
      </Prompt>
      <TypedAnswer placeholder="toki pona…" />
    </div>
  );
}

export function ListenEx({ ex }: { ex: Of<'listen'> }) {
  const script = settings.value.script;
  useKeys((e, onButton) => {
    if (e.key === ' ' && !onButton && !answered()) {
      speak(ex.word.id);
      return true;
    }
  });
  return (
    <div class="stage">
      <Prompt label="Which word do you hear?">
        <button type="button" class="listen-big" onClick={() => speak(ex.word.id)} aria-label="Play the word again">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
        </button>
        <span class="learn-hint-inline">
          tap to replay <kbd aria-hidden="true">space</kbd>
        </span>
        <SpeakOnMount text={ex.word.id} />
      </Prompt>
      {ex.mode === 'choice' ? (
        <Options
          items={ex.options}
          idOf={(o) => o.id}
          isAnswer={(o) => o.id === ex.word.id}
          chosen={chosenId()}
          label={() => undefined}
          render={(o) => (
            <span class="option-word">
              {script !== 'latin' && <Glyph name={o.glyph} class="option-glyph-sm" />}
              <span lang="tok">{o.id}</span>
            </span>
          )}
        />
      ) : (
        <TypedAnswer placeholder="type what you hear…" />
      )}
    </div>
  );
}

function SpeakOnMount({ text }: { text: string }) {
  useEffect(() => {
    const t = setTimeout(() => speak(text), 250);
    return () => clearTimeout(t);
  }, [text]);
  return null;
}

// ── particle fill-in ─────────────────────────────────────────────────────────

export function FillEx({ ex }: { ex: Of<'fill'> }) {
  const chosen = chosenId();
  const done = answered();
  return (
    <div class="stage">
      <Prompt label="Fill in the missing word">
        <span class="sentence-line" lang="tok">
          {ex.tokens.map((t, i) =>
            i === ex.blank ? (
              <span key={i} class={`blank ${done ? (chosen === ex.word.id ? 'is-correct' : 'is-wrong') : ''}`}>
                {done ? ex.word.id : ' '}
              </span>
            ) : (
              <span key={i}>{t}</span>
            ),
          )}
        </span>
        <span class="sentence-en">{ex.sentence.en}</span>
      </Prompt>
      <Options
        items={ex.options}
        idOf={(o) => o}
        isAnswer={(o) => o === ex.word.id}
        chosen={chosen}
        grid={false}
        label={() => undefined}
        render={(o) => <span lang="tok">{o}</span>}
      />
    </div>
  );
}

// ── sentence builder ─────────────────────────────────────────────────────────

export function BuildEx({ ex }: { ex: Of<'build'> }) {
  const [placed, setPlaced] = useState<number[]>([]);
  const done = answered();
  const bank = ex.tiles.map((t, i) => ({ t, i })).filter(({ i }) => !placed.includes(i));
  const complete = placed.length === ex.tiles.length;
  const check = () => complete && !done && respond({ kind: 'sequence', words: placed.map((i) => ex.tiles[i]) });

  useKeys((e, onButton) => {
    if (done) return false;
    const d = digit(e);
    if (d >= 0 && d < bank.length) {
      setPlaced([...placed, bank[d].i]);
      return true;
    }
    if (e.key === 'Backspace' && placed.length) {
      setPlaced(placed.slice(0, -1));
      return true;
    }
    if (e.key === 'Enter' && !onButton && complete) {
      check();
      return true;
    }
  });

  return (
    <div class="stage">
      <Prompt label="Build the sentence in toki pona">
        <span class="card-gloss card-gloss-lg">{ex.sentence.en}</span>
      </Prompt>
      <div class={`answer-row ${done ? (live.value?.result?.correct ? 'is-correct' : 'is-wrong') : ''}`} aria-label="Your sentence">
        {placed.length === 0 && <span class="answer-placeholder">Tap the words in order</span>}
        {placed.map((i) => (
          <button
            key={i}
            type="button"
            class="tile is-placed"
            lang="tok"
            disabled={done}
            onClick={() => setPlaced(placed.filter((p) => p !== i))}
            aria-label={`${ex.tiles[i]}, remove`}
          >
            {ex.tiles[i]}
          </button>
        ))}
      </div>
      <div class="tile-bank" aria-label="Words">
        {bank.map(({ t, i }, n) => (
          <button key={i} type="button" class="tile" lang="tok" disabled={done} onClick={() => setPlaced([...placed, i])}>
            <kbd aria-hidden="true">{n + 1}</kbd>
            {t}
          </button>
        ))}
      </div>
      <button type="button" class="btn btn-primary" disabled={!complete || done} onClick={check}>
        Check <kbd aria-hidden="true">enter</kbd>
      </button>
    </div>
  );
}

// ── spot the mistake ─────────────────────────────────────────────────────────

export function SpotEx({ ex }: { ex: Of<'spot'> }) {
  const done = answered();
  const r = live.value?.response;
  const picked = r?.kind === 'index' ? r.index : -1;
  useKeys((e) => {
    const d = digit(e);
    if (done || d < 0 || d >= ex.mistake.tokens.length) return false;
    respond({ kind: 'index', index: d });
    return true;
  });
  return (
    <div class="stage">
      <Prompt label="Tap the word that's wrong">
        <span class="spot-row" lang="tok">
          {ex.mistake.tokens.map((t, i) => {
            const state = !done ? '' : i === ex.mistake.wrongIndex ? 'is-correct' : i === picked ? 'is-wrong' : 'is-dim';
            return (
              <button
                key={i}
                type="button"
                class={`spot-word ${state}`}
                disabled={done}
                onClick={() => respond({ kind: 'index', index: i })}
              >
                {t}
                <kbd aria-hidden="true">{i + 1}</kbd>
              </button>
            );
          })}
        </span>
        <span class="sentence-en">One word breaks a grammar rule.</span>
      </Prompt>
    </div>
  );
}

// ── translate toki pona → English ────────────────────────────────────────────

export function TranslateEx({ ex }: { ex: Of<'translate'> }) {
  const [value, setValue] = useState('');
  const done = answered();
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => area.current?.focus({ preventScroll: true }), []);
  const submit = () => !done && value.trim() && respond({ kind: 'text', value });
  return (
    <div class="stage">
      <Prompt label="Translate into English">
        {settings.value.script !== 'latin' && <SitelenText text={ex.sentence.tok} class="sentence-sitelen" />}
        <span class="sentence-line" lang="tok">
          {ex.sentence.tok}
        </span>
        <SpeakButton text={ex.sentence.tok} />
      </Prompt>
      <form
        class="typed"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={area}
          class="typed-input typed-area"
          rows={2}
          value={value}
          disabled={done}
          placeholder="In English…"
          aria-label="Your translation"
          onInput={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div class="typed-actions">
          <button type="button" class="btn" disabled={done} onClick={() => respond({ kind: 'text', value: '' })}>
            I don't know
          </button>
          <button type="submit" class="btn btn-primary" disabled={done || !value.trim()}>
            Check <kbd aria-hidden="true">enter</kbd>
          </button>
        </div>
      </form>
    </div>
  );
}

// ── self-graded flashcard ────────────────────────────────────────────────────

const SELF: { r: Grade; label: string; cls: string }[] = [
  { r: Rating.Again, label: 'Forgot', cls: 'btn-miss' },
  { r: Rating.Hard, label: 'Hard', cls: '' },
  { r: Rating.Good, label: 'Good', cls: 'btn-got' },
  { r: Rating.Easy, label: 'Easy', cls: '' },
];

export function FlashEx({ ex }: { ex: Of<'flash'> }) {
  const [shown, setShown] = useState(false);
  const script = settings.value.script;
  useKeys((e, onButton) => {
    if (!shown && (e.key === ' ' || e.key === 'Enter') && !onButton) {
      setShown(true);
      return true;
    }
    const d = digit(e);
    if (shown && d >= 0 && d < 4) {
      respond({ kind: 'self', rating: SELF[d].r });
      return true;
    }
  });
  return (
    <div class="stage">
      <Prompt label={shown ? 'How well did you remember?' : 'Do you remember this word?'}>
        {shown ? (
          <>
            <WordLine w={ex.word} script={script} />
            <span class="card-gloss card-gloss-lg">{ex.word.concept}</span>
            <Examples w={ex.word} limit={1} />
          </>
        ) : (
          <WordHero w={ex.word} script={script} drawKey={`f-${ex.word.id}`} />
        )}
      </Prompt>
      {shown ? (
        <div class="self-grade" role="group" aria-label="Rate your recall">
          {SELF.map((s, i) => (
            <button key={s.r} type="button" class={`btn ${s.cls}`} onClick={() => respond({ kind: 'self', rating: s.r })}>
              <kbd aria-hidden="true">{i + 1}</kbd> {s.label}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" class="btn btn-primary" onClick={() => setShown(true)}>
          Show meaning <kbd aria-hidden="true">space</kbd>
        </button>
      )}
    </div>
  );
}
