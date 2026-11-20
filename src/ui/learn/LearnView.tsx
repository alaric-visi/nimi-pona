import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { learnActions, live, screen, type Live } from '../../app/learn';
import { UnitView } from './UnitView';
import { CheckpointView } from './CheckpointView';
import { PlacementView } from './PlacementView';
import { MISTAKE_EXPLANATION } from '../../lang/mistakes';
import { Glyph } from '../components/Glyph';
import { LearnHome } from './LearnHome';
import { useKeys } from './useKeys';
import {
  BuildEx, ChoiceEx, FillEx, FlashEx, GlyphEx, IntroEx, ListenEx, SpotEx, TranslateEx, TypedEx,
} from './Exercises';

export function LearnView() {
  const l = live.value;
  if (l) return <Session l={l} />;
  const sc = screen.value;
  switch (sc.kind) {
    case 'unit': return <UnitView key={sc.id} id={sc.id} />;
    case 'checkpoint': return <CheckpointView key={sc.id} id={sc.id} />;
    case 'placement': return <PlacementView />;
    default: return <LearnHome />;
  }
}

function ExerciseSwitch({ l }: { l: Live }) {
  const ex = l.exercise;
  switch (ex.type) {
    case 'intro': return <IntroEx ex={ex} />;
    case 'choice': return <ChoiceEx ex={ex} />;
    case 'glyph': return <GlyphEx ex={ex} />;
    case 'typed': return <TypedEx ex={ex} />;
    case 'listen': return <ListenEx ex={ex} />;
    case 'fill': return <FillEx ex={ex} />;
    case 'build': return <BuildEx ex={ex} />;
    case 'spot': return <SpotEx ex={ex} />;
    case 'translate': return <TranslateEx ex={ex} />;
    case 'flash': return <FlashEx ex={ex} />;
  }
}

const SKILL_LABEL = { recognise: 'meaning', recall: 'recall', glyph: 'sitelen pona', listen: 'listening' } as const;

function Session({ l }: { l: Live }) {
  const item = l.run.queue[0];
  const done = l.run.total - l.run.queue.length;
  // a fresh component per step, so typed text, placed tiles etc. never leak between exercises
  const stepKey = `${done}-${item.id}-${l.exercise.type}`;
  const top = useRef<HTMLDivElement>(null);
  // each new exercise starts with its prompt in view
  useEffect(() => {
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [stepKey]);
  return (
    <div class="learn-session" ref={top}>
      <div class="progress">
        <div class="progress-meta">
          <span>
            <strong>{done}</strong> of {l.run.total}
            <span class="skill-tag">{item.intro ? 'new word' : SKILL_LABEL[item.skill]}</span>
          </span>
          <button type="button" class="link-btn" onClick={learnActions.quit}>
            End session
          </button>
        </div>
        <div class="progress-track" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={l.run.total} aria-valuenow={done}>
          <div class="progress-fill" style={{ transform: `scaleX(${l.run.total ? done / l.run.total : 0})` }} />
        </div>
      </div>
      <ExerciseSwitch key={stepKey} l={l} />
      {l.result && <Feedback key={`fb-${stepKey}`} l={l} />}
    </div>
  );
}

function Feedback({ l }: { l: Live }) {
  const { exercise: ex, result } = l;
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    btn.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  useKeys((e, onButton) => {
    if ((e.key === 'Enter' || e.key === 'ArrowRight') && !onButton) {
      learnActions.next();
      return true;
    }
  });
  if (!result) return null;
  const w = ex.word;

  let detail = null;
  switch (ex.type) {
    case 'fill':
    case 'build':
      detail = (
        <p class="feedback-body">
          <span lang="tok" class="feedback-word">{ex.sentence.tok}</span>
          <br />
          {ex.sentence.en}
        </p>
      );
      break;
    case 'spot':
      detail = (
        <>
          <p class="feedback-body">{MISTAKE_EXPLANATION[ex.mistake.rule]}</p>
          <p class="feedback-body">
            Correct: <span lang="tok" class="feedback-word">{ex.mistake.correct}</span>
          </p>
        </>
      );
      break;
    case 'translate':
      detail = (
        <>
          <p class="feedback-body">
            <span class="card-small-label">model answer</span> {ex.sentence.en}
          </p>
          {ex.sentence.alt.length > 0 && (
            <p class="feedback-alt">also: {ex.sentence.alt.join(' · ')}</p>
          )}
          {result.score !== undefined && (
            <p class="feedback-alt">Meaning covered: {Math.round(result.score * 100)}%</p>
          )}
        </>
      );
      break;
    default:
      detail = (
        <p class="feedback-body feedback-answer">
          <Glyph name={w.glyph} class="line-glyph" />
          <span lang="tok" class="feedback-word">{w.id}</span> — {w.concept}
        </p>
      );
  }

  return (
    <div class={`feedback is-${result.correct ? 'correct' : 'wrong'}`} role="status" ref={panel}>
      <p class="feedback-title" lang="tok">
        {result.correct ? 'pona!' : 'ike…'}
      </p>
      {detail}
      {result.note && <p class="feedback-alt">{result.note}</p>}
      <div class="feedback-actions">
        {ex.type === 'translate' && !result.correct && (
          <button type="button" class="btn" onClick={learnActions.override}>
            I was right
          </button>
        )}
        <button type="button" class="btn btn-primary" ref={btn} onClick={learnActions.next}>
          Continue <kbd aria-hidden="true">enter</kbd>
        </button>
      </div>
    </div>
  );
}
