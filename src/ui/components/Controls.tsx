import { useEffect, useRef } from 'preact/hooks';
import { TOPICS, inTopic } from '../../data/words';
import { actions, isPractice, pool, session, settings } from '../../app/store';
import { screen } from '../../app/learn';
import { playScreen } from '../../app/play';
import type { Mode } from '../../engine/session';
import { Glyph } from './Glyph';

/** Each topic is illustrated by the sitelen pona glyph of a word at its heart. */
const TOPIC_GLYPH: Record<string, string> = {
  all: 'ale', people: 'jan', body: 'sijelo', animals: 'soweli', nature: 'kasi', food: 'moku',
  objects: 'ijo', places: 'tomo', colours: 'kule', qualities: 'pona', actions: 'pali', mind: 'pilin',
  senses: 'lukin', communication: 'toki', position: 'poka', time: 'tenpo', numbers: 'nanpa', grammar: 'li',
};

/** Top-level sections. */
export function NavSwitch() {
  const mode = settings.value.mode;
  const items = [
    {
      id: 'learn',
      label: 'Learn',
      active: mode === 'learn',
      // coming back to Learn from another section lands on the path, not a stale sub-screen
      go: () => {
        screen.value = { kind: 'home' };
        actions.setMode('learn');
      },
    },
    {
      id: 'play',
      label: 'Play',
      active: mode === 'play' || isPractice(mode),
      go: () => {
        playScreen.value = { kind: 'hub' };
        actions.setMode('play');
      },
    },
    { id: 'dict', label: 'Dictionary', active: mode === 'dict', go: () => actions.setMode('dict') },
  ];
  return (
    <div class="segmented segmented-3" role="group" aria-label="Section">
      {items.map((it) => (
        <button key={it.id} type="button" class="segment" aria-pressed={it.active} onClick={() => (!it.active || it.id === 'play') && it.go()}>
          {it.id === 'play' ? (
            <>
              Play <span lang="tok" class="segment-tp">musi</span>
            </>
          ) : (
            it.label
          )}
        </button>
      ))}
    </div>
  );
}

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'flash', label: 'Cards', hint: 'toki pona → English, self-graded' },
  { id: 'quiz', label: 'Quiz', hint: 'Pick the meaning from four' },
  { id: 'rev', label: 'Recall', hint: 'English → toki pona, self-graded' },
];

export function ModeSwitch() {
  const mode = settings.value.mode;
  return (
    <div class="segmented segmented-3 segmented-sub" role="group" aria-label="Practice mode">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          class="segment"
          aria-pressed={mode === m.id}
          title={m.hint}
          onClick={() => mode !== m.id && actions.setMode(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function CategoryChips() {
  const active = settings.value.category;
  const counts = Object.fromEntries(TOPICS.map((t) => [t, pool.value.filter((w) => inTopic(w, t)).length]));
  const rowRef = useRef<HTMLDivElement>(null);

  // On narrow screens the row scrolls sideways; keep the active chip visible.
  useEffect(() => {
    rowRef.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [active]);

  return (
    <div class="chips" role="group" aria-label="Topic" ref={rowRef}>
      {TOPICS.map((c) => (
        <button
          key={c}
          type="button"
          class="chip"
          aria-pressed={active === c}
          disabled={counts[c] === 0}
          onClick={() => active !== c && actions.setCategory(c)}
        >
          {settings.value.script !== 'latin' && <Glyph name={TOPIC_GLYPH[c]} class="chip-glyph" />}
          {c}
          <span class="chip-count" aria-hidden="true">{counts[c]}</span>
          <span class="visually-hidden">, {counts[c]} words</span>
        </button>
      ))}
    </div>
  );
}

export function Progress() {
  const s = session.value;
  const total = s.deck.length;
  const position = Math.min(s.index + 1, total);
  const pct = total ? (s.index / total) * 100 : 0;
  return (
    <div class="progress">
      <div class="progress-meta">
        <span>
          Card <strong>{position}</strong> of {total}
        </span>
        <span class="progress-stats">
          <span>
            <strong>{s.correct}</strong>/{s.seen} correct
          </span>
          <span class={s.streak >= 3 ? 'streak is-hot' : 'streak'}>
            streak <strong>{s.streak}</strong>
          </span>
        </span>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        aria-label="Round progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={s.index}
      >
        <div class="progress-fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}
