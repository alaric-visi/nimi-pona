/**
 * $P point-cloud gesture recogniser (Vatavu, Anthony & Wobbrock, 2012), used to judge
 * glyph tracing. A drawing and a template are each resampled to N points, scaled and
 * centred, then matched as unordered clouds — so stroke order and direction don't matter,
 * which suits sitelen pona (there is no official stroke order).
 */

export interface Pt {
  x: number;
  y: number;
  /** stroke index */
  id: number;
}

export const N = 48;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts: readonly Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) d += dist(pts[i - 1], pts[i]);
  return d;
}

export function resample(input: readonly Pt[], n = N): Pt[] {
  if (input.length === 0) return [];
  const pts = input.map((p) => ({ ...p }));
  const interval = pathLength(pts) / (n - 1);
  if (interval === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  let acc = 0;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id !== pts[i - 1].id) continue;
    const d = dist(pts[i - 1], pts[i]);
    if (acc + d >= interval) {
      const t = (interval - acc) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y), id: pts[i].id };
      out.push(q);
      pts.splice(i, 0, q);
      acc = 0;
    } else acc += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

/** Uniform scale into the unit box (aspect preserved), then centroid to the origin. */
export function normalise(pts: readonly Pt[]): Pt[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const scaled = pts.map((p) => ({ x: (p.x - minX) / size, y: (p.y - minY) / size, id: p.id }));
  const cx = scaled.reduce((a, p) => a + p.x, 0) / scaled.length;
  const cy = scaled.reduce((a, p) => a + p.y, 0) / scaled.length;
  return scaled.map((p) => ({ x: p.x - cx, y: p.y - cy, id: p.id }));
}

export const prepare = (pts: readonly Pt[]): Pt[] => normalise(resample(pts));

function cloudDistance(a: readonly Pt[], b: readonly Pt[], start: number): number {
  const matched = new Array(a.length).fill(false);
  let sum = 0;
  let i = start;
  do {
    let best = Infinity;
    let index = -1;
    for (let j = 0; j < b.length; j++) {
      if (matched[j]) continue;
      const d = dist(a[i], b[j]);
      if (d < best) {
        best = d;
        index = j;
      }
    }
    matched[index] = true;
    const weight = 1 - ((i - start + a.length) % a.length) / a.length;
    sum += weight * best;
    i = (i + 1) % a.length;
  } while (i !== start);
  return sum;
}

/** $P greedy cloud match: lower is more similar. Both inputs must be prepared. */
export function greedyMatch(a: readonly Pt[], b: readonly Pt[]): number {
  const step = Math.floor(Math.sqrt(a.length));
  let min = Infinity;
  for (let i = 0; i < a.length; i += step) {
    min = Math.min(min, cloudDistance(a, b, i), cloudDistance(b, a, i));
  }
  return min;
}

export interface Ranked<T> {
  item: T;
  score: number;
}

/** Rank templates by similarity to a drawing (best first). */
export function rank<T>(drawing: readonly Pt[], templates: readonly { item: T; points: readonly Pt[] }[]): Ranked<T>[] {
  const d = prepare(drawing);
  return templates
    .map((t) => ({ item: t.item, score: greedyMatch(d, t.points) }))
    .sort((a, b) => a.score - b.score);
}
