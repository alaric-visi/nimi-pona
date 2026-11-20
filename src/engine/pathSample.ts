import type { Pt } from './recognizer';

/**
 * Sample points along SVG path data made of absolute M / L / Q / C / Z commands
 * (what opentype.js emits for our glyphs). Each subpath becomes its own "stroke".
 * Pure, so glyph templates can be built and tested without a DOM.
 */
export function samplePath(d: string, perCurve = 10): Pt[] {
  const tokens = d.match(/[MLQCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let cmd = '';
  let x = 0, y = 0, sx = 0, sy = 0;
  let id = -1;
  const num = () => Number(tokens[i++]);
  const push = (px: number, py: number) => pts.push({ x: px, y: py, id });

  while (i < tokens.length) {
    if (/[MLQCZ]/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    switch (cmd) {
      case 'M':
        x = sx = num();
        y = sy = num();
        id++;
        push(x, y);
        cmd = 'L'; // implicit lineto after the first pair
        break;
      case 'L': {
        const nx = num(), ny = num();
        for (let k = 1; k <= 3; k++) push(x + ((nx - x) * k) / 3, y + ((ny - y) * k) / 3);
        x = nx; y = ny;
        break;
      }
      case 'Q': {
        const x1 = num(), y1 = num(), nx = num(), ny = num();
        for (let k = 1; k <= perCurve; k++) {
          const t = k / perCurve, u = 1 - t;
          push(u * u * x + 2 * u * t * x1 + t * t * nx, u * u * y + 2 * u * t * y1 + t * t * ny);
        }
        x = nx; y = ny;
        break;
      }
      case 'C': {
        const x1 = num(), y1 = num(), x2 = num(), y2 = num(), nx = num(), ny = num();
        for (let k = 1; k <= perCurve; k++) {
          const t = k / perCurve, u = 1 - t;
          push(
            u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * nx,
            u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ny,
          );
        }
        x = nx; y = ny;
        break;
      }
      case 'Z':
        for (let k = 1; k <= 3; k++) push(x + ((sx - x) * k) / 3, y + ((sy - y) * k) / 3);
        x = sx; y = sy;
        break;
      default:
        i++; // unknown token: skip
    }
  }
  return pts;
}
