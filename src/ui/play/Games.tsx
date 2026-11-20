import { useEffect, useMemo, useState } from 'preact/hooks';
import { PUZZLES } from '../../data/puzzles';
import { WORD_BY_ID } from '../../data/words';
import { srs, voiceAvailable } from '../../app/learn';
import { playActions, readToday, today } from '../../app/play';
import { cue, pool, settings } from '../../app/store';
import { speak } from '../../app/speech';
import { pickDistractors, shuffle } from '../../engine/deck';
import { judgePuzzle, puzzleTiles, type Puzzle } from '../../engine/play';
import { cardId } from '../../engine/srs';
import { Glyph, SitelenText } from '../components/Glyph';
import { digit, useKeys } from '../learn/useKeys';
import { PlayBack } from './PlayView';

const sound = (c: 'correct' | 'wrong' | 'complete') => settings.value.sound && cue(c);

// ── daily sentence ───────────────────────────────────────────────────────────

export function DailyToki() {
  const s = today.value;
  const [shown, setShown] = useState(readToday.value);
  const reveal = () => {
    setShown(true);
    playActions.markDailyRead();
  };
  return (
    <article class="game" aria-labelledby="daily-title">
      <PlayBack />
      <h2 id="daily-title" class="unit-title">
        <span lang="tok">toki pi tenpo suno</span> <span class="unit-title-en">Today's sentence</span>
      </h2>
      <p class="checkpoint-intro">One sentence a day, chosen from words you've met. Read it, say it out loud, then check.</p>
      <div class="daily-card">
        {settings.value.script !== 'latin' && <SitelenText text={s.tok} class="daily-sitelen" />}
        <p class="daily-tok" lang="tok">
          {s.tok}
        </p>
        {voiceAvailable() && (
          <button type="button" class="btn" onClick={() => speak(s.tok)}>
            Hear it
          </button>
        )}
        {shown ? (
          <div class="daily-answer" role="status">
            <p class="daily-en">{s.en}</p>
            {s.alt.length > 0 && <p class="feedback-alt">also: {s.alt.join(' · ')}</p>}
            <p class="feedback-alt">
              Words:{' '}
              {s.words.map((w, i) => (
                <span key={w}>
                  {i > 0 && ', '}
                  <span lang="tok">{w}</span> ({WORD_BY_ID.get(w)?.glosses[0]})
                </span>
              ))}
            </p>
          </div>
        ) : (
          <button type="button" class="btn btn-primary" onClick={reveal}>
            Show the meaning
          </button>
        )}
      </div>
      {shown && <p class="dialog-note"><span lang="tok">pona!</span> Come back tomorrow for a new one.</p>}
    </article>
  );
}

// ── speed round ──────────────────────────────────────────────────────────────

const SECONDS = 60;

export function SpeedRound() {
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [left, setLeft] = useState(SECONDS);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null);
  const [round, setRound] = useState(0);
  const best = srs.value.extras.speedBest;

  // prefer words the learner has met; fall back to the whole pool for newcomers
  const words = useMemo(() => {
    const met = pool.value.filter((w) => srs.value.cards[cardId(w.id, 'recognise')]);
    return met.length >= 12 ? met : pool.value;
  }, [phase === 'play']);
  const q = useMemo(() => {
    const w = words[Math.floor(Math.random() * words.length)];
    return { word: w, options: shuffle([w, ...pickDistractors(w, pool.value, 3)]) };
  }, [round, words]);

  useEffect(() => {
    if (phase !== 'play') return;
    const started = Date.now();
    const t = setInterval(() => {
      const remaining = Math.max(0, SECONDS - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(t);
        setPhase('done');
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') {
      playActions.recordSpeed(score);
      sound('complete');
    }
  }, [phase]);

  const answer = (id: string) => {
    if (phase !== 'play') return;
    const right = id === q.word.id;
    if (right) setScore((s) => s + 1);
    else setMissed((m) => (m.includes(q.word.id) ? m : [...m, q.word.id]));
    setFlash(right ? 'right' : 'wrong');
    setTimeout(() => setFlash(null), 250);
    setRound((r) => r + 1);
  };

  const start = () => {
    setScore(0);
    setMissed([]);
    setLeft(SECONDS);
    setRound((r) => r + 1);
    setPhase('play');
  };

  useKeys((e, onButton) => {
    if (phase === 'play') {
      const d = digit(e);
      if (d >= 0 && d < 4) {
        answer(q.options[d].id);
        return true;
      }
    } else if (e.key === 'Enter' && !onButton) {
      start();
      return true;
    }
  });

  return (
    <article class="game" aria-labelledby="speed-title">
      <PlayBack />
      <h2 id="speed-title" class="unit-title">
        <span lang="tok">tenpo lili</span> <span class="unit-title-en">Speed round</span>
      </h2>
      {phase === 'ready' && (
        <>
          <p class="checkpoint-intro">
            {SECONDS} seconds. Pick the meaning of as many words as you can — keys 1–4 are fastest. No penalty for wrong
            answers, just keep going.
            {best > 0 && ` Your best is ${best}.`}
          </p>
          <button type="button" class="btn btn-primary learn-start" onClick={start}>
            Start <kbd aria-hidden="true">enter</kbd>
          </button>
        </>
      )}
      {phase === 'play' && (
        <div class="stage">
          <div class="speed-bar">
            <span class="speed-time" aria-label={`${left} seconds left`}>
              {left}s
            </span>
            <span class="progress-track speed-track">
              <span class="progress-fill" style={{ transform: `scaleX(${left / SECONDS})` }} />
            </span>
            <span class="speed-score" aria-live="polite">
              {score}
            </span>
          </div>
          <div class={`card card-static learn-prompt ${flash ? `flash-${flash}` : ''}`}>
            <span class="card-face">
              {settings.value.script !== 'latin' && <Glyph name={q.word.glyph} class="hero-glyph" />}
              {settings.value.script !== 'glyphs' && (
                <span class={settings.value.script === 'latin' ? 'card-word' : 'card-word card-word-under'} lang="tok">
                  {q.word.id}
                </span>
              )}
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
        </div>
      )}
      {phase === 'done' && (
        <div class="done">
          <Glyph name={score >= best && score > 0 ? 'wawa' : 'pona'} draw class="done-glyph" />
          <p class="done-label">{score > 0 && score >= best ? 'New best!' : 'Time!'}</p>
          <p class="done-score">{score}</p>
          <p class="done-detail">Best: {Math.max(best, score)}</p>
          {missed.length > 0 && (
            <p class="done-msg">
              <span class="done-msg-en">
                Worth another look:{' '}
                {missed.slice(0, 8).map((w, i) => (
                  <span key={w}>
                    {i > 0 && ', '}
                    <span lang="tok">{w}</span>
                  </span>
                ))}
              </span>
            </p>
          )}
          <button type="button" class="btn btn-primary" onClick={start}>
            Again <kbd aria-hidden="true">enter</kbd>
          </button>
        </div>
      )}
    </article>
  );
}

// ── compound puzzles ─────────────────────────────────────────────────────────

export function PuzzleGame() {
  const solved = srs.value.extras.puzzles;
  const [order] = useState(() => {
    const unsolved = shuffle(PUZZLES.filter((p) => !solved.includes(p.en)));
    return [...unsolved, ...shuffle(PUZZLES.filter((p) => solved.includes(p.en)))];
  });
  const [i, setI] = useState(0);
  const puzzle: Puzzle = order[i % order.length];
  const tiles = useMemo(() => puzzleTiles(puzzle, pool.value, Math.random), [i]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<'accepted' | 'other' | null>(null);
  const [hint, setHint] = useState(false);
  const script = settings.value.script;
  const answer = placed.map((n) => tiles[n]);

  const check = () => {
    if (!answer.length || verdict) return;
    const v = judgePuzzle(answer, puzzle);
    setVerdict(v);
    if (v === 'accepted') {
      playActions.recordPuzzle(puzzle.en);
      sound('correct');
    }
  };
  const next = () => {
    setI(i + 1);
    setPlaced([]);
    setVerdict(null);
    setHint(false);
  };

  useKeys((e, onButton) => {
    if (verdict) {
      if (e.key === 'Enter' && !onButton) {
        next();
        return true;
      }
      return false;
    }
    const bank = tiles.map((t, n) => ({ t, n })).filter(({ n }) => !placed.includes(n));
    const d = digit(e);
    if (d >= 0 && d < bank.length) {
      setPlaced([...placed, bank[d].n]);
      return true;
    }
    if (e.key === 'Backspace' && placed.length) {
      setPlaced(placed.slice(0, -1));
      return true;
    }
    if (e.key === 'Enter' && !onButton && placed.length) {
      check();
      return true;
    }
  });

  const bank = tiles.map((t, n) => ({ t, n })).filter(({ n }) => !placed.includes(n));
  return (
    <article class="game" aria-labelledby="puzzle-title">
      <PlayBack />
      <h2 id="puzzle-title" class="unit-title">
        <span lang="tok">o nimi e ni!</span> <span class="unit-title-en">Name this</span>
      </h2>
      <p class="checkpoint-intro">
        Toki Pona has no word for most things — you describe them. Build a description from the words below. There's more
        than one right answer. {solved.length}/{PUZZLES.length} solved.
      </p>
      <div class="card card-static learn-prompt">
        <span class="card-face">
          <span class="card-label">How would you say…</span>
          <span class="card-gloss card-gloss-lg">{puzzle.en}</span>
          {hint ? (
            <span class="card-meta">hint: {puzzle.hint}</span>
          ) : (
            !verdict && (
              <button type="button" class="link-btn" onClick={() => setHint(true)}>
                Need a hint?
              </button>
            )
          )}
        </span>
      </div>
      <div class={`answer-row ${verdict === 'accepted' ? 'is-correct' : ''}`} aria-label="Your description">
        {placed.length === 0 && <span class="answer-placeholder">Head word first, then what kind</span>}
        {placed.map((n) => (
          <button key={n} type="button" class="tile is-placed" lang="tok" disabled={!!verdict} onClick={() => setPlaced(placed.filter((p) => p !== n))}>
            {tiles[n]}
          </button>
        ))}
      </div>
      <div class="tile-bank" aria-label="Words">
        {bank.map(({ t, n }, k) => (
          <button key={n} type="button" class="tile" lang="tok" disabled={!!verdict} onClick={() => setPlaced([...placed, n])}>
            <kbd aria-hidden="true">{k + 1}</kbd>
            {script !== 'latin' && <Glyph name={WORD_BY_ID.get(t)?.glyph ?? t} class="tile-glyph" />}
            {t}
          </button>
        ))}
      </div>
      {!verdict ? (
        <button type="button" class="btn btn-primary" disabled={!placed.length} onClick={check}>
          Check <kbd aria-hidden="true">enter</kbd>
        </button>
      ) : (
        <div class={`feedback is-${verdict === 'accepted' ? 'correct' : 'wrong'}`} role="status">
          <p class="feedback-title" lang="tok">
            {verdict === 'accepted' ? 'pona!' : 'ni li ante…'}
          </p>
          <p class="feedback-body">
            {verdict === 'accepted' ? 'People say:' : 'People usually say:'}{' '}
            {puzzle.accept.map((a, k) => (
              <span key={a}>
                {k > 0 && ' · '}
                <span lang="tok" class="feedback-word">{a}</span>
              </span>
            ))}
          </p>
          {verdict === 'other' && (
            <p class="feedback-alt">
              Yours — <span lang="tok">{answer.join(' ')}</span> — may still make sense in context. Remember: the head word
              comes first.
            </p>
          )}
          <div class="feedback-actions">
            {verdict === 'other' && (
              <button
                type="button"
                class="btn"
                onClick={() => {
                  playActions.recordPuzzle(puzzle.en);
                  setVerdict('accepted');
                }}
              >
                Mine works too
              </button>
            )}
            <button type="button" class="btn btn-primary" ref={(b) => b?.focus({ preventScroll: true })} onClick={next}>
              Next <kbd aria-hidden="true">enter</kbd>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
