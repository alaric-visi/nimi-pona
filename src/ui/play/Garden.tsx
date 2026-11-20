import { plants } from '../../app/play';
import type { Plant } from '../../engine/play';

const H = 46; // viewBox height; width is 100

/**
 * ma kasi — a garden with one plant per learned word. Drawn in the visual language of
 * sitelen pona (the kasi glyph: a stem with paired leaves). Taller = held in memory
 * longer; a flower = remembered for a month or more. Nothing ever wilts: forgetting
 * a word just means it's due for review.
 */
export function Garden({ compact = false }: { compact?: boolean }) {
  const list = plants.value;
  return (
    <figure class={`garden ${compact ? 'is-compact' : ''}`}>
      <svg viewBox={`0 0 100 ${H}`} class="garden-svg" role="img" aria-label={`Garden with ${list.length} plants, one per learned word.`}>
        <path d={`M0 ${H - 6} Q 50 ${H - 9} 100 ${H - 6} L100 ${H} L0 ${H} Z`} class="garden-soil" />
        {list.map((p) => (
          <PlantShape key={p.word} p={p} />
        ))}
      </svg>
      <figcaption class="garden-caption">
        {list.length === 0 ? (
          <>
            <span lang="tok">ma kasi</span> — your garden. A plant grows for every word you learn.
          </>
        ) : (
          <>
            <span lang="tok">ma kasi</span> — {list.length} {list.length === 1 ? 'plant' : 'plants'}, one for each learned
            word. They grow taller as memories settle, and flower after a month.
          </>
        )}
      </figcaption>
    </figure>
  );
}

function PlantShape({ p }: { p: Plant }) {
  const ground = H - 6 + p.depth * 3; // front rows sit lower on the bed
  const height = 6 + p.growth * 22;
  const scale = 0.75 + p.depth * 0.35;
  const top = ground - height * scale;
  const leaves = Array.from({ length: p.leaves }, (_, i) => ground - ((i + 1) / (p.leaves + 1)) * height * scale);
  const leaf = 2.6 * scale;
  return (
    <g class="plant" transform={`rotate(${p.lean} ${p.x} ${ground})`}>
      <title>{p.word}</title>
      <line x1={p.x} y1={ground} x2={p.x} y2={top} class="plant-stem" />
      {leaves.map((y, i) => (
        <g key={i}>
          <path d={`M${p.x} ${y} q ${-leaf} ${-leaf * 0.2} ${-leaf * 1.3} ${-leaf}`} class="plant-leaf" />
          <path d={`M${p.x} ${y} q ${leaf} ${-leaf * 0.2} ${leaf * 1.3} ${-leaf}`} class="plant-leaf" />
        </g>
      ))}
      {p.flowering ? (
        <circle cx={p.x} cy={top - 1.2 * scale} r={1.6 * scale} class="plant-flower" />
      ) : (
        <circle cx={p.x} cy={top} r={0.7 * scale} class="plant-bud" />
      )}
    </g>
  );
}
