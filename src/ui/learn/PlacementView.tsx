import { useMemo, useRef, useEffect, useState } from 'preact/hooks';
import { WORD_BY_ID, type Word } from '../../data/words';
import { learnActions, units } from '../../app/learn';
import { pool, settings } from '../../app/store';
import { pickDistractors, shuffle } from '../../engine/deck';
import { Glyph } from '../components/Glyph';
import { BackLink } from './UnitView';
import { digit, useKeys } from './useKeys';

const PER_UNIT = 3;
const NEED = 2;

/**
 * Placement: three quick meaning questions per unit, in path order. Stop at the
 * first unit where fewer than two are right; everything before it is skipped,
 * and its words go straight into spaced review as "already known".
 */
export function PlacementView() {
  const coreUnits = units.value.filter((u) => !u.optional && u.words.length > 0);
  const [unitIndex, setUnitIndex] = useState(0);
  const [qi, setQi] = useState(0);
  const [right, setRight] = useState(0);
  const [passedThrough, setPassedThrough] = useState(0);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const unit = coreUnits[unitIndex];

  const questions = useMemo(() => {
    if (!unit) return [];
    const inPool = new Set(pool.value.map((w) => w.id));
    const words = shuffle(unit.words.filter((w) => inPool.has(w))).slice(0, PER_UNIT).map((w) => WORD_BY_ID.get(w)!);
    return words.map((w: Word) => ({ word: w, options: shuffle([w, ...pickDistractors(w, pool.value, 3)]) }));
  }, [unitIndex]);
  const q = questions[qi];

  const finishUnit = (score: number) => {
    if (score >= NEED && unitIndex + 1 < coreUnits.length) {
      setPassedThrough(unit.n);
      setUnitIndex(unitIndex + 1);
      setQi(0);
      setRight(0);
    } else {
      if (score >= NEED) setPassedThrough(unit.n);
      setDone(true);
    }
  };

  const answer = (id: string | null) => {
    const score = right + (id === q.word.id ? 1 : 0);
    setRight(score);
    // stop early once the unit is decided either way
    const remaining = questions.length - qi - 1;
    if (score >= NEED || score + remaining < NEED || remaining === 0) return finishUnit(score);
    setQi(qi + 1);
  };

  useKeys((e) => {
    if (!started || done || !q) return false;
    const d = digit(e);
    if (d >= 0 && d < q.options.length) {
      answer(q.options[d].id);
      return true;
    }
  });

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [started, done]);

  if (!started) {
    return (
      <article class="checkpoint">
        <BackLink />
        <h2 class="unit-title" ref={heading} tabIndex={-1}>
          Placement test
        </h2>
        <p class="checkpoint-intro">
          Already know some Toki Pona? Answer a few quick questions — three per unit, in path order. You'll start at the
          first unit you don't know yet; words from earlier units go straight into your reviews.
        </p>
        <div class="checkpoint-actions">
          <button type="button" class="btn btn-primary" onClick={() => setStarted(true)}>
            Begin
          </button>
        </div>
      </article>
    );
  }

  if (done) {
    const startAt = coreUnits.find((u) => u.n > passedThrough);
    return (
      <article class="checkpoint">
        <div class="done">
          <Glyph name={passedThrough > 0 ? 'sona' : 'open'} draw class="done-glyph" />
          <p class="done-label">Placement result</p>
          <h2 class="done-score" ref={heading} tabIndex={-1}>
            {startAt ? `Unit ${startAt.n}` : 'All done'}
          </h2>
          <p class="done-msg">
            <span class="done-msg-en">
              {passedThrough === 0
                ? 'Starting from the beginning is the best way in.'
                : `You know units 1–${passedThrough}. Their words will come back as reviews to keep them fresh.`}
            </span>
          </p>
          <div class="checkpoint-actions">
            <button type="button" class="btn btn-primary" onClick={() => learnActions.place(passedThrough)}>
              {startAt ? `Start at unit ${startAt.n}` : 'Go to the path'}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article class="checkpoint">
      <div class="progress">
        <div class="progress-meta">
          <span>
            Unit <strong>{unit.n}</strong> of {coreUnits.length} · question {qi + 1}
          </span>
          <button type="button" class="link-btn" onClick={() => setDone(true)}>
            Stop here
          </button>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style={{ transform: `scaleX(${unitIndex / coreUnits.length})` }} />
        </div>
      </div>
      <div class="stage">
        <div class="card card-static learn-prompt">
          <span class="card-face">
            <span class="card-label">What does this mean?</span>
            {settings.value.script !== 'latin' && <Glyph name={q.word.glyph} class="hero-glyph" />}
            <span class={settings.value.script === 'latin' ? 'card-word' : 'card-word card-word-under'} lang="tok">
              {q.word.id}
            </span>
          </span>
        </div>
        <ol class="options" aria-label="Choices">
          {q.options.map((o, i) => (
            <li key={o.id}>
              <button type="button" class="option" onClick={() => answer(o.id)}>
                <kbd aria-hidden="true">{i + 1}</kbd>
                <span class="option-text">{o.concept}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" class="btn" onClick={() => answer(null)}>
          I don't know
        </button>
      </div>
    </article>
  );
}
