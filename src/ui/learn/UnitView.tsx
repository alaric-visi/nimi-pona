import { useEffect, useRef } from 'preact/hooks';
import { UNIT_BY_ID, PHRASES, type TextPair } from '../../data/path';
import { WORD_BY_ID } from '../../data/words';
import { learnActions, masteryOf, srs, statuses, voiceAvailable } from '../../app/learn';
import { settings, pool } from '../../app/store';
import { speak } from '../../app/speech';
import { MASTERY_THRESHOLD } from '../../engine/path';
import { cardId, isLearned } from '../../engine/srs';
import { Glyph, SitelenText } from '../components/Glyph';

export function BackLink({ label = 'Path' }: { label?: string }) {
  return (
    <button type="button" class="link-btn back-link" onClick={() => learnActions.open({ kind: 'home' })}>
      ← {label}
    </button>
  );
}

export function SpeakLine({ text }: { text: string }) {
  if (!voiceAvailable()) return null;
  return (
    <button type="button" class="mini-speak" onClick={() => speak(text)} aria-label={`Play: ${text}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      </svg>
    </button>
  );
}

export function ExampleBlock({ ex }: { ex: TextPair }) {
  return (
    <li class="lesson-example">
      {settings.value.script !== 'latin' && <SitelenText text={ex.tok} />}
      <span class="lesson-example-tok">
        <span lang="tok">{ex.tok}</span>
        <SpeakLine text={ex.tok} />
      </span>
      <span class="lesson-example-en">{ex.en}</span>
    </li>
  );
}

export function UnitView({ id }: { id: string }) {
  const unit = UNIT_BY_ID.get(id)!;
  const status = statuses.value.get(id) ?? 'locked';
  const m = masteryOf(unit);
  const s = srs.value;
  const lessonRead = s.path.lessons.includes(id);
  const checkpointPassed = s.path.checkpoints.includes(id) || unit.n <= s.path.placed;
  const inPool = new Set(pool.value.map((w) => w.id));
  const words = unit.words.filter((w) => inPool.has(w)).map((w) => WORD_BY_ID.get(w)!);
  const phrases = PHRASES.filter((p) => p.unit === unit.n);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [id]);

  return (
    <article class="unit" aria-labelledby="unit-title">
      <BackLink />
      <header class="unit-head">
        <Glyph name={unit.glyph} draw class="unit-glyph" />
        <div>
          <p class="unit-kicker">
            {unit.optional ? 'Bonus unit' : `Unit ${unit.n}`} · {unit.focus}
          </p>
          <h2 id="unit-title" class="unit-title" ref={heading} tabIndex={-1}>
            <span lang="tok">{unit.tp}</span> <span class="unit-title-en">{unit.title}</span>
          </h2>
          <p class={`unit-status is-${status}`}>
            {status === 'complete' ? 'Complete' : status === 'current' ? 'You are here' : 'Locked — finish the units before it first'}
          </p>
        </div>
      </header>

      <section class="lesson" aria-label="Lesson">
        <p class="lesson-idea">{unit.lesson.idea}</p>
        <ul class="lesson-points">
          {unit.lesson.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <ol class="lesson-examples">
          {unit.lesson.examples.map((ex) => (
            <ExampleBlock key={ex.tok} ex={ex} />
          ))}
        </ol>
      </section>

      {words.length > 0 && (
        <section class="unit-section" aria-labelledby="unit-words">
          <h3 id="unit-words" class="unit-section-title">
            New words <span class="unit-count">{m.learned}/{m.total} learned</span>
          </h3>
          <ul class="word-grid">
            {words.map((w) => {
              const learned = isLearned(s.cards[cardId(w.id, 'recognise')]);
              const started = !!s.cards[cardId(w.id, 'recognise')];
              return (
                <li key={w.id} class={`word-tile ${learned ? 'is-learned' : started ? 'is-started' : ''}`}>
                  <Glyph name={w.glyph} class="word-tile-glyph" />
                  <span class="word-tile-text">
                    <span lang="tok" class="word-tile-word">
                      {w.id}
                    </span>
                    <span class="word-tile-concept">{w.concept}</span>
                  </span>
                  {learned && <span class="word-tile-check" aria-label="learned">✓</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {phrases.length > 0 && (
        <section class="unit-section" aria-labelledby="unit-phrases">
          <h3 id="unit-phrases" class="unit-section-title">
            Phrases unlocked
          </h3>
          <ul class="phrase-list">
            {phrases.map((p) => (
              <li key={p.tok}>
                <span lang="tok">{p.tok}</span>
                <span class="phrase-en">{p.en}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {status !== 'locked' && (
        <section class="unit-actions">
          {words.length > 0 && (
            <p class="unit-progress-note">
              To complete this unit: learn {Math.ceil(m.total * MASTERY_THRESHOLD)} of its {m.total} words in practice
              {m.learned >= Math.ceil(m.total * MASTERY_THRESHOLD) ? ' ✓' : ` (${m.learned} so far)`}, and pass the
              checkpoint{checkpointPassed ? ' ✓' : ''}.
            </p>
          )}
          {status === 'current' && words.length > 0 && (
            <button
              type="button"
              class="btn btn-primary"
              onClick={() => (lessonRead ? learnActions.start() : learnActions.finishLesson(id))}
            >
              {lessonRead ? 'Practise' : 'Start practising these words'}
            </button>
          )}
          <button
            type="button"
            class={`btn ${words.length === 0 && status === 'current' ? 'btn-primary' : ''}`}
            onClick={() => learnActions.open({ kind: 'checkpoint', id })}
          >
            {checkpointPassed ? 'Read the story again' : 'Checkpoint: read & answer'}
          </button>
        </section>
      )}
    </article>
  );
}
