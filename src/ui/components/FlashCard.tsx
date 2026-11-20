import { useEffect, useRef } from 'preact/hooks';
import { actions, card, session, settings } from '../../app/store';
import { Examples, Glosses, Meta, Note, WordHero, WordLine } from './WordBits';
import { useTilt } from './useTilt';

/** Flash (tp → en) and Recall (en → tp) share this card; only the faces differ. */
export function FlashCard() {
  const s = session.value;
  const w = card.value!;
  const script = settings.value.script;
  const rev = s.mode === 'rev';
  const btnRef = useRef<HTMLButtonElement>(null);
  const tilt = useTilt(btnRef);

  // New card: focus the card if the learner was working inside the stage, and centre the ink origin.
  useEffect(() => {
    const el = btnRef.current;
    el?.style.setProperty('--ink-x', '50%');
    el?.style.setProperty('--ink-y', '50%');
    const active = document.activeElement;
    if (!active || active === document.body || active.closest('.stage')) el?.focus();
  }, [s.index, s.mode]);

  /** The answer spreads out like ink from wherever the card was touched. */
  const setInkOrigin = (e: PointerEvent) => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--ink-x', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--ink-y', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const front = rev ? (
    <>
      <span class="card-label">English → toki pona</span>
      <span class="card-gloss card-gloss-lg">{w.concept}</span>
      <Meta w={w} />
    </>
  ) : (
    <>
      <span class="card-label">toki pona</span>
      <WordHero w={w} script={script} drawKey={`${s.index}-${s.mode}`} />
      <Meta w={w} />
    </>
  );

  const back = rev ? (
    <>
      <span class="card-label">toki pona</span>
      {/* the answer: draw the glyph in as it's revealed */}
      <WordHero w={w} script={script === 'glyphs' ? 'both' : script} drawKey={s.revealed ? `rev-${s.index}` : undefined} />
      <span class="card-gloss">{w.concept}</span>
      <Examples w={w} />
      <Note w={w} />
    </>
  ) : (
    <>
      <span class="card-label">meaning</span>
      <WordLine w={w} script={script} />
      <span class="card-gloss card-gloss-lg">{w.concept}</span>
      <Glosses w={w} />
      <Examples w={w} />
      <Note w={w} />
    </>
  );

  const frontLabel = rev
    ? `${w.concept}. Show the toki pona word.`
    : script === 'glyphs'
      ? 'A sitelen pona glyph. Show the answer.'
      : `${w.id}. Show meaning.`;

  return (
    <div class="stage">
      {/* keyed per card: a new card mounts already closed, so the old reveal never
          animates shut over the next card's answer */}
      <button
        key={`${s.index}-${s.mode}`}
        ref={btnRef}
        type="button"
        class={`card ${s.revealed ? 'is-flipped' : ''}`}
        onClick={actions.flip}
        onPointerDown={setInkOrigin}
        {...tilt}
        aria-label={s.revealed ? undefined : frontLabel}
      >
        <span class="card-inner">
          <span class="card-face card-front" aria-hidden={s.revealed}>
            {front}
            <span class="card-hint" aria-hidden="true">
              tap or press <kbd>space</kbd>
            </span>
          </span>
          <span class="card-face card-back" aria-hidden={!s.revealed}>
            {back}
          </span>
        </span>
      </button>

      <div class={`grade-row ${s.revealed ? 'is-visible' : ''}`}>
        <button type="button" class="btn btn-miss" onClick={() => actions.grade(false)} tabIndex={s.revealed ? 0 : -1}>
          <kbd aria-hidden="true">1</kbd> Missed it
        </button>
        <button type="button" class="btn btn-got" onClick={() => actions.grade(true)} tabIndex={s.revealed ? 0 : -1}>
          <kbd aria-hidden="true">2</kbd> Got it
        </button>
      </div>
    </div>
  );
}
