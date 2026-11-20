import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { WORD_BY_ID } from '../../data/words';
import { srs } from '../../app/learn';
import { glyphTemplates, playActions } from '../../app/play';
import { cue, pool, settings } from '../../app/store';
import { rank, type Pt } from '../../engine/recognizer';
import { cardId } from '../../engine/srs';
import { shuffle } from '../../engine/deck';
import { Glyph } from '../components/Glyph';
import { PlayBack } from './PlayView';

/** A drawing counts if the intended glyph is among the recogniser's top matches. */
const TOP_K = 3;

/**
 * Trace sitelen pona by hand. "Trace" shows the glyph faintly under the canvas;
 * "From memory" hides it. The drawing is compared with every glyph using the $P
 * point-cloud recogniser, so stroke order and direction never matter.
 */
export function TraceGame({ word }: { word?: string }) {
  const queue = useMemo(() => {
    const met = pool.value.filter((w) => srs.value.cards[cardId(w.id, 'recognise')]);
    const list = shuffle(met.length >= 6 ? met : pool.value).map((w) => w.id);
    return word ? [word, ...list.filter((w) => w !== word)] : list;
  }, [word]);
  const [i, setI] = useState(0);
  const target = WORD_BY_ID.get(queue[i % queue.length])!;
  const [memory, setMemory] = useState(false);
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const [result, setResult] = useState<{ ok: boolean; top: string[] } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Pt[] | null>(null);

  const redraw = (list: Pt[][]) => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const css = getComputedStyle(document.documentElement);
    g.clearRect(0, 0, c.width, c.height);
    g.strokeStyle = css.getPropertyValue('--ink').trim() || '#1d2433';
    g.lineWidth = c.width / 34;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of list) {
      g.beginPath();
      s.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      if (s.length === 1) g.lineTo(s[0].x + 0.1, s[0].y);
      g.stroke();
    }
  };

  // crisp canvas at device resolution
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const size = c.getBoundingClientRect().width;
    c.width = c.height = Math.round(size * (window.devicePixelRatio || 1));
    redraw(strokes);
  }, []);

  const point = (e: PointerEvent): Pt => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height, id: strokes.length };
  };

  const down = (e: PointerEvent) => {
    if (result) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = [point(e)];
  };
  const move = (e: PointerEvent) => {
    if (!drawing.current) return;
    drawing.current.push(point(e));
    redraw([...strokes, drawing.current]);
  };
  const up = () => {
    if (!drawing.current) return;
    const next = [...strokes, drawing.current];
    drawing.current = null;
    setStrokes(next);
    redraw(next);
  };

  const check = () => {
    const pts = strokes.flat();
    if (pts.length < 4) return;
    const ranked = rank(pts, glyphTemplates());
    const top = ranked.slice(0, TOP_K).map((r) => r.item);
    const ok = top.includes(target.id);
    setResult({ ok, top });
    if (ok) playActions.recordTrace(target.id);
    if (settings.value.sound) cue(ok ? 'correct' : 'wrong');
  };
  const clear = () => {
    setStrokes([]);
    setResult(null);
    redraw([]);
  };
  const next = () => {
    clear();
    setI(i + 1);
  };

  const traced = srs.value.extras.traced[target.id] ?? 0;
  return (
    <article class="game" aria-labelledby="trace-title">
      <PlayBack />
      <h2 id="trace-title" class="unit-title">
        <span lang="tok">sitelen</span> <span class="unit-title-en">Glyph tracing</span>
      </h2>
      <div class="segmented segmented-sub trace-mode" role="group" aria-label="Mode">
        <button type="button" class="segment" aria-pressed={!memory} onClick={() => setMemory(false)}>
          Trace
        </button>
        <button type="button" class="segment" aria-pressed={memory} onClick={() => setMemory(true)}>
          From memory
        </button>
      </div>
      <p class="trace-prompt">
        Draw <span lang="tok" class="trace-word">{target.id}</span> — {target.concept}
        {traced > 0 && <span class="trace-count"> · drawn {traced}×</span>}
      </p>
      <div class={`trace-pad ${result ? (result.ok ? 'is-correct' : 'is-wrong') : ''}`}>
        {(!memory || result) && (
          <Glyph name={target.glyph} class="trace-guide" />
        )}
        <canvas
          ref={canvas}
          class="trace-canvas"
          aria-label={`Drawing area. Draw the sitelen pona glyph for ${target.id}.`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
      {result ? (
        <div class={`feedback is-${result.ok ? 'correct' : 'wrong'}`} role="status">
          <p class="feedback-title" lang="tok">
            {result.ok ? 'pona!' : 'ike…'}
          </p>
          <p class="feedback-body">
            {result.ok
              ? 'That reads as ' + target.id + '.'
              : `That looked more like: ${result.top.join(', ')}. Compare with the glyph above.`}
          </p>
          <div class="feedback-actions">
            <button type="button" class="btn" onClick={clear}>
              Draw again
            </button>
            <button type="button" class="btn btn-primary" onClick={next}>
              Next glyph
            </button>
          </div>
        </div>
      ) : (
        <div class="checkpoint-actions">
          <button type="button" class="btn" disabled={!strokes.length} onClick={() => {
            const s = strokes.slice(0, -1);
            setStrokes(s);
            redraw(s);
          }}>
            Undo stroke
          </button>
          <button type="button" class="btn btn-primary" disabled={!strokes.length} onClick={check}>
            Check
          </button>
        </div>
      )}
      <p class="dialog-note">sitelen pona has no fixed stroke order — draw it any way that looks right.</p>
    </article>
  );
}
