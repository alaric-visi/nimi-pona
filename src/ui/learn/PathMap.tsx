import { learnActions, masteryOf, statuses, units } from '../../app/learn';
import { Glyph } from '../components/Glyph';

/** x positions (percent of width) the road winds through, repeating. */
const WIND = [24, 50, 76, 50];
const ROW = 104; // px between stops

/**
 * nasin — the learning path as a winding road. Completed stretches are inked,
 * the current stop carries the vermilion seal colour, later stops are faint.
 */
export function PathMap() {
  const list = units.value;
  const st = statuses.value;
  const points = list.map((_, i) => ({ x: WIND[i % WIND.length], y: ROW / 2 + i * ROW }));
  const height = list.length * ROW;
  const currentIndex = list.findIndex((u) => st.get(u.id) === 'current');
  const doneUpTo = currentIndex === -1 ? list.length - 1 : currentIndex;

  // Smooth road through the stops: vertical-tangent cubic segments.
  const road = (upTo: number) =>
    points.slice(0, upTo + 1).reduce((d, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const mid = (prev.y + p.y) / 2;
      return `${d} C ${prev.x} ${mid} ${p.x} ${mid} ${p.x} ${p.y}`;
    }, '');

  return (
    <section class="path" aria-labelledby="path-title">
      <h2 id="path-title" class="path-title">
        <span lang="tok">nasin</span> · the path
      </h2>
      <div class="path-map" style={{ height: `${height}px` }}>
        <svg class="path-road" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={road(list.length - 1)} class="road-ahead" vector-effect="non-scaling-stroke" />
          {doneUpTo > 0 && <path d={road(doneUpTo)} class="road-done" vector-effect="non-scaling-stroke" />}
        </svg>
        <ol class="path-stops">
          {list.map((u, i) => {
            const status = st.get(u.id)!;
            const p = points[i];
            const m = masteryOf(u);
            const side = p.x <= 50 ? 'right' : 'left';
            return (
              <li
                key={u.id}
                class={`stop is-${status} label-${side}`}
                style={{ left: `${p.x}%`, top: `${p.y}px` }}
              >
                <button
                  type="button"
                  class="stop-btn"
                  onClick={() => learnActions.open({ kind: 'unit', id: u.id })}
                  aria-label={`Unit ${u.n}: ${u.title}. ${status === 'complete' ? 'Complete' : status === 'current' ? 'Current unit' : 'Locked'}.`}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  <Glyph name={u.glyph} class="stop-glyph" />
                  {status === 'complete' && (
                    <span class="stop-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
                <span class="stop-label" aria-hidden="true">
                  <span class="stop-n">
                    {u.optional ? '★' : u.n} · <span lang="tok">{u.tp}</span>
                  </span>
                  <span class="stop-title">{u.title}</span>
                  {status === 'current' && m.total > 0 && (
                    <span class="stop-meter">
                      <span style={{ transform: `scaleX(${m.learned / m.total})` }} />
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
