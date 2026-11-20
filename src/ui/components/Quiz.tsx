import { useEffect, useRef } from 'preact/hooks';
import { actions, card, session, settings } from '../../app/store';
import { quizResult } from '../../engine/session';
import { Examples, Meta, Note, WordHero } from './WordBits';

export function Quiz() {
  const s = session.value;
  const w = card.value!;
  const quiz = s.quiz!;
  const result = quizResult(s);
  const promptRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  // Focus follows the flow: question → (answer) → continue → next question.
  useEffect(() => {
    if (result) continueRef.current?.focus();
  }, [result]);
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active.closest('.stage')) promptRef.current?.focus();
  }, [s.index]);

  return (
    <div class="stage">
      <div
        class={`card card-static ${result ? `is-${result}` : ''}`}
        ref={promptRef}
        tabIndex={-1}
        aria-label={settings.value.script === 'glyphs' ? 'What does this sitelen pona glyph mean?' : `What does ${w.id} mean?`}
      >
        <span class="card-face">
          <span class="card-label">What does this mean?</span>
          {/* new question: ink it in. Wrong answer: trace it again, slowly, to invite a second look. */}
          <WordHero
            w={w}
            script={settings.value.script === 'glyphs' && result ? 'both' : settings.value.script}
            drawKey={result === 'wrong' ? `again-${s.index}` : `q-${s.index}`}
          />
          <Meta w={w} />
        </span>
      </div>

      <ol class="options" aria-label="Choices">
        {quiz.options.map((o, i) => {
          const isAnswer = o.id === w.id;
          const isChosen = o.id === quiz.chosen;
          const state = !result ? '' : isAnswer ? 'is-correct' : isChosen ? 'is-wrong' : 'is-dim';
          return (
            <li key={o.id}>
              <button
                type="button"
                class={`option ${state}`}
                disabled={!!result}
                onClick={() => actions.answer(o.id)}
              >
                <kbd aria-hidden="true">{i + 1}</kbd>
                <span class="option-text">{o.concept}</span>
                {result && isAnswer && <span class="option-mark" aria-label="correct answer">✓</span>}
                {result && isChosen && !isAnswer && <span class="option-mark" aria-label="your answer">✗</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {result && (
        <div class={`feedback is-${result}`}>
          <p class="feedback-title" lang="tok">
            {result === 'correct' ? 'pona!' : 'ike…'}
          </p>
          <p class="feedback-body">
            <span lang="tok" class="feedback-word">{w.id}</span> — {w.concept}
          </p>
          <Examples w={w} limit={1} />
          <Note w={w} />
          <button type="button" class="btn btn-primary" ref={continueRef} onClick={actions.advance}>
            Continue <kbd aria-hidden="true">enter</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
