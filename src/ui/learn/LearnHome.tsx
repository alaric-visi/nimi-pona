import { useEffect, useRef } from 'preact/hooks';
import { learnActions, overview, srs, srsLoaded, storageOk, summary } from '../../app/learn';
import { Glyph } from '../components/Glyph';
import { PathMap } from './PathMap';
import { openPlay, readToday, today } from '../../app/play';
import { actions } from '../../app/store';

function when(d: Date): string {
  const mins = Math.round((d.getTime() - Date.now()) / 60_000);
  if (mins < 60) return `in ${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} h`;
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

export function LearnHome() {
  const o = overview.value;
  const s = summary.value;
  const startRef = useRef<HTMLButtonElement>(null);
  const anything = o.due + o.newToday > 0;
  const unit = o.unit;
  // the next thing to do: reviews first, then the current unit's lesson, then new words
  const lessonFirst = o.lessonNeeded && o.due === 0;
  const fresh = o.startedWords === 0 && srs.value.path.placed === 0;

  useEffect(() => {
    if (srsLoaded.value) startRef.current?.focus();
  }, [srsLoaded.value, !!s]);

  if (!srsLoaded.value) return <p class="learn-loading">Opening your progress…</p>;

  return (
    <section class="learn-home" aria-labelledby="learn-title">
      {s && (
        <div class="summary" role="status">
          <Glyph name={s.answered && s.correct / s.answered >= 0.8 ? 'pona' : 'awen'} draw class="summary-glyph" />
          <div>
            <h2 class="summary-title">{s.endedEarly ? 'Session paused' : 'Session complete'}</h2>
            <p class="summary-line">
              {s.answered ? `${s.correct} of ${s.answered} right` : 'Nothing answered yet'}
              {s.newWords.length > 0 && (
                <>
                  {' '}· new: <span lang="tok">{s.newWords.join(', ')}</span>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div class="learn-card">
        <p class="card-label learn-label">kama sona · learn</p>
        <h2 id="learn-title" class="learn-title">
          {lessonFirst && unit
            ? `Next: unit ${unit.n}`
            : anything
              ? s
                ? 'Keep going?'
                : "Today's practice"
              : 'All caught up'}
        </h2>

        <dl class="learn-stats">
          <div>
            <dt>Due now</dt>
            <dd>{o.due}</dd>
          </div>
          <div>
            <dt>New today</dt>
            <dd>{o.newToday}</dd>
          </div>
          <div>
            <dt>Words learned</dt>
            <dd>
              {o.learnedWords}
              <span class="learn-of"> / {o.total}</span>
            </dd>
          </div>
        </dl>

        <div class="learn-meter" role="progressbar" aria-label="Words learned" aria-valuemin={0} aria-valuemax={o.total} aria-valuenow={o.learnedWords}>
          <span style={{ transform: `scaleX(${o.total ? o.startedWords / o.total : 0})` }} class="learn-meter-started" />
          <span style={{ transform: `scaleX(${o.total ? o.learnedWords / o.total : 0})` }} class="learn-meter-learned" />
        </div>

        {lessonFirst && unit ? (
          <button
            ref={startRef}
            type="button"
            class="btn btn-primary learn-start"
            onClick={() => learnActions.open({ kind: 'unit', id: unit.id })}
          >
            <span lang="tok">{unit.tp}</span> · {unit.title} <kbd aria-hidden="true">enter</kbd>
          </button>
        ) : anything ? (
          <button ref={startRef} type="button" class="btn btn-primary learn-start" onClick={learnActions.start}>
            {s ? 'Another session' : 'Start session'} <kbd aria-hidden="true">enter</kbd>
          </button>
        ) : (
          <p class="learn-rest">
            <span lang="tok">pona!</span> Nothing is due.
            {o.nextDue ? ` Your next review is ${when(o.nextDue)}.` : ''}
            {unit && !o.lessonNeeded ? ` Finish unit ${unit.n} by passing its checkpoint, or rest — rest is part of remembering.` : ' Rest is part of remembering.'}
          </p>
        )}
        {o.lessonNeeded && o.due > 0 && unit && (
          <button type="button" class="link-btn" onClick={() => learnActions.open({ kind: 'unit', id: unit.id })}>
            Then: unit {unit.n} lesson — {unit.title}
          </button>
        )}
        {fresh && (
          <button type="button" class="link-btn" onClick={() => learnActions.open({ kind: 'placement' })}>
            Already know some toki pona? Take the placement test
          </button>
        )}

        <p class="learn-hint">
          Each unit teaches one idea and a handful of words. Short sessions mix reviews with new words; each word is
          practised as meaning, recall, sitelen pona and listening, each on its own spaced-repetition schedule.
        </p>
        {!storageOk.value && (
          <p class="learn-warning">Progress can't be saved in this browser (storage is blocked), so it will be lost when you close the page.</p>
        )}
      </div>
      {!readToday.value && (
        <button
          type="button"
          class="daily-strip"
          onClick={() => {
            actions.setMode('play');
            openPlay({ kind: 'daily' });
          }}
        >
          <Glyph name="suno" class="daily-strip-glyph" />
          <span>
            <span class="daily-strip-label">Today's sentence</span>
            <span lang="tok" class="daily-strip-tok">
              {today.value.tok}
            </span>
          </span>
        </button>
      )}
      <PathMap />
    </section>
  );
}
