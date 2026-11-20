import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { UNIT_BY_ID } from '../../data/path';
import { learnActions, masteryOf } from '../../app/learn';
import { cue, settings } from '../../app/store';
import { shuffle } from '../../engine/deck';
import { MASTERY_THRESHOLD, passed } from '../../engine/path';
import { SitelenText, Glyph } from '../components/Glyph';
import { SpeakLine } from './UnitView';
import { digit, useKeys } from './useKeys';

/**
 * A unit's checkpoint: read a short dialogue or story, then answer comprehension
 * questions. Translations stay hidden until asked for — reading is the point.
 */
export function CheckpointView({ id }: { id: string }) {
  const unit = UNIT_BY_ID.get(id)!;
  const cp = unit.checkpoint;
  const glyphOnly = cp.script === 'glyphs';
  const [attempt, setAttempt] = useState(0);
  const [showEn, setShowEn] = useState(false);
  const [showLatin, setShowLatin] = useState<Set<number>>(new Set());
  const [stage, setStage] = useState<'read' | 'questions' | 'result'>('read');
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  // shuffle options per attempt, remembering where the right answer went
  const questions = useMemo(
    () =>
      cp.questions.map((q) => {
        const order = shuffle(q.options.map((_, i) => i));
        return { q: q.q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
      }),
    [id, attempt],
  );
  const question = questions[qi];
  const ok = passed(score, questions.length);
  const m = masteryOf(unit);

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [stage, id]);

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const right = i === question.answer;
    if (right) setScore((s) => s + 1);
    if (settings.value.sound) cue(right ? 'correct' : 'wrong');
  };

  const next = () => {
    if (qi + 1 < questions.length) {
      setQi(qi + 1);
      setPicked(null);
      return;
    }
    setStage('result');
    if (passed(score, questions.length)) {
      learnActions.passCheckpoint(id);
      if (settings.value.sound) cue('complete');
    }
  };

  const retry = () => {
    setAttempt((a) => a + 1);
    setStage('read');
    setQi(0);
    setPicked(null);
    setScore(0);
  };

  useKeys((e, onButton) => {
    if (stage !== 'questions') return false;
    const d = digit(e);
    if (picked === null && d >= 0 && d < question.options.length) {
      choose(d);
      return true;
    }
    if (picked !== null && e.key === 'Enter' && !onButton) {
      next();
      return true;
    }
  });

  return (
    <article class="checkpoint" aria-labelledby="cp-title">
      <button type="button" class="link-btn back-link" onClick={() => learnActions.open({ kind: 'unit', id })}>
        ← Unit {unit.optional ? '★' : unit.n}
      </button>
      <h2 id="cp-title" class="unit-title" ref={heading} tabIndex={-1}>
        Checkpoint · <span lang="tok">{unit.tp}</span>
      </h2>

      {stage === 'read' && (
        <>
          <p class="checkpoint-intro">
            {glyphOnly
              ? 'This story is written in sitelen pona only. Tap a line to see it in Latin letters.'
              : 'Read it through — out loud if you can. Translations are there if you need them.'}
          </p>
          <ol class="story">
            {cp.lines.map((line, i) => (
              <li key={i} class="story-line">
                {line.who && <span class="story-who">{line.who}</span>}
                {(glyphOnly || settings.value.script !== 'latin') && (
                  <button
                    type="button"
                    class="story-sitelen"
                    disabled={!glyphOnly}
                    aria-label={glyphOnly ? `Line ${i + 1} in sitelen pona. Show Latin.` : undefined}
                    aria-hidden={glyphOnly ? undefined : true}
                    onClick={() => setShowLatin(new Set([...showLatin, i]))}
                  >
                    <SitelenText text={line.tok} />
                  </button>
                )}
                {(!glyphOnly || showLatin.has(i)) && (
                  <span class="story-tok">
                    <span lang="tok">{line.tok}</span>
                    <SpeakLine text={line.tok} />
                  </span>
                )}
                {showEn && <span class="story-en">{line.en}</span>}
              </li>
            ))}
          </ol>
          <div class="checkpoint-actions">
            <button type="button" class="btn" aria-pressed={showEn} onClick={() => setShowEn(!showEn)}>
              {showEn ? 'Hide translations' : 'Show translations'}
            </button>
            <button type="button" class="btn btn-primary" onClick={() => setStage('questions')}>
              Answer {questions.length} questions
            </button>
          </div>
        </>
      )}

      {stage === 'questions' && (
        <div class="stage">
          <p class="progress-meta">
            Question <strong>{qi + 1}</strong> of {questions.length}
          </p>
          <div class="card card-static learn-prompt">
            <span class="card-face">
              <span class="card-gloss card-gloss-lg">{question.q}</span>
            </span>
          </div>
          <ol class="options" aria-label="Choices">
            {question.options.map((o, i) => {
              const state = picked === null ? '' : i === question.answer ? 'is-correct' : i === picked ? 'is-wrong' : 'is-dim';
              return (
                <li key={o}>
                  <button type="button" class={`option ${state}`} disabled={picked !== null} onClick={() => choose(i)}>
                    <kbd aria-hidden="true">{i + 1}</kbd>
                    <span class="option-text">{o}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {picked !== null && (
            <div class={`feedback is-${picked === question.answer ? 'correct' : 'wrong'}`} role="status">
              <p class="feedback-title" lang="tok">
                {picked === question.answer ? 'pona!' : 'ike…'}
              </p>
              <button type="button" class="btn btn-primary" ref={(b) => b?.focus({ preventScroll: true })} onClick={next}>
                {qi + 1 < questions.length ? 'Next question' : 'See result'} <kbd aria-hidden="true">enter</kbd>
              </button>
            </div>
          )}
        </div>
      )}

      {stage === 'result' && (
        <div class="done">
          <Glyph name={ok ? 'pona' : 'awen'} draw class="done-glyph" />
          <p class="done-label">{ok ? 'Checkpoint passed' : 'Not quite yet'}</p>
          <p class="done-score">
            {score}
            <span class="done-pct">/{questions.length}</span>
          </p>
          <p class="done-msg">
            {ok ? (
              m.total === 0 || m.learned / m.total >= MASTERY_THRESHOLD ? (
                <span class="done-msg-en">Unit complete — the next stretch of the path is open.</span>
              ) : (
                <span class="done-msg-en">
                  Keep practising this unit's words: {m.learned} of {m.total} learned so far. The unit completes once you've
                  learned {Math.ceil(m.total * MASTERY_THRESHOLD)}.
                </span>
              )
            ) : (
              <span class="done-msg-en">Read the story again — you need {Math.ceil(questions.length * (2 / 3))} right to pass.</span>
            )}
          </p>
          <div class="checkpoint-actions">
            {!ok && (
              <button type="button" class="btn btn-primary" onClick={retry}>
                Try again
              </button>
            )}
            <button type="button" class={`btn ${ok ? 'btn-primary' : ''}`} onClick={() => learnActions.open({ kind: 'home' })}>
              Back to the path
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
