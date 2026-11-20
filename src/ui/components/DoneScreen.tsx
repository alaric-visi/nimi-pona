import { useEffect, useRef } from 'preact/hooks';
import { actions, lifetime, session } from '../../app/store';
import { doneMessage, scorePercent } from '../../engine/session';
import { Glyph } from './Glyph';

export function DoneScreen() {
  const s = session.value;
  const pct = scorePercent(s);
  const msg = doneMessage(pct);
  const life = lifetime.value;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section class="done" aria-labelledby="done-heading">
      <Glyph name={msg.glyph} draw class="done-glyph" />
      <p class="done-label">Round complete</p>
      <h2 id="done-heading" class="done-score" ref={headingRef} tabIndex={-1}>
        {pct}
        <span class="done-pct">%</span>
      </h2>
      <p class="done-detail">
        {s.correct} of {s.seen} correct
      </p>
      <p class="done-msg">
        <span lang="tok" class="done-msg-tok">{msg.tok}</span>
        <span class="done-msg-en">{msg.en}</span>
      </p>
      <button type="button" class="btn btn-primary" onClick={actions.restart}>
        <span lang="tok">o musi sin!</span> · Play again
      </button>
      <dl class="lifetime">
        <div>
          <dt>All-time seen</dt>
          <dd>{life.seen}</dd>
        </div>
        <div>
          <dt>All-time correct</dt>
          <dd>{life.seen ? Math.round((life.correct / life.seen) * 100) : 0}%</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{life.bestStreak}</dd>
        </div>
      </dl>
    </section>
  );
}
