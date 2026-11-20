import { openPlay, playScreen } from '../../app/play';
import { PlayHub } from './PlayHub';
import { NameGame } from './NameGame';
import { DailyToki, PuzzleGame, SpeedRound } from './Games';
import { TraceGame } from './TraceGame';

export function PlayBack() {
  return (
    <button type="button" class="link-btn back-link" onClick={() => openPlay({ kind: 'hub' })}>
      ← <span lang="tok">musi</span>
    </button>
  );
}

export function PlayView() {
  const s = playScreen.value;
  switch (s.kind) {
    case 'names': return <NameGame />;
    case 'puzzles': return <PuzzleGame />;
    case 'speed': return <SpeedRound />;
    case 'daily': return <DailyToki />;
    case 'trace': return <TraceGame key={s.word ?? 'any'} word={s.word} />;
    default: return <PlayHub />;
  }
}
