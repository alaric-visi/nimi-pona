import { GLYPH_FRAME, glyphFor, sitelenParts } from '../../data/glyphs';

const VIEWBOX = `${GLYPH_FRAME.x} ${GLYPH_FRAME.y} ${GLYPH_FRAME.w} ${GLYPH_FRAME.h}`;

interface GlyphProps {
  /** glyph key (word id) */
  name: string;
  /** play the ink-drawing animation when mounted (remount with a new `key` to replay) */
  draw?: boolean;
  class?: string;
  /** accessible label; omit for decorative glyphs next to the Latin word */
  label?: string;
}

/**
 * One sitelen pona glyph as inline SVG. The outline is traced as a stroke and then
 * filled, which reads as ink being laid down (see .glyph-draw in components.css).
 */
export function Glyph({ name, draw = false, class: cls = '', label }: GlyphProps) {
  const g = glyphFor(name);
  if (!g) return null;
  return (
    <svg
      class={`glyph ${draw ? 'glyph-draw' : ''} ${cls}`}
      viewBox={VIEWBOX}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={g.d} pathLength={1} />
    </svg>
  );
}

/** A name written in a cartouche: one glyph per letter, inside a rounded ink frame. */
export function Cartouche({ name, keys }: { name: string; keys: string[] }) {
  return (
    <span class="cartouche" title={name}>
      {keys.map((k, i) => (
        <Glyph key={`${k}-${i}`} name={k} class="cartouche-glyph" />
      ))}
    </span>
  );
}

/** A whole sentence in sitelen pona. Decorative: the Latin text always accompanies it. */
export function SitelenText({ text, class: cls = '' }: { text: string; class?: string }) {
  const parts = sitelenParts(text);
  if (!parts.length) return null;
  return (
    <span class={`sitelen ${cls}`} aria-hidden="true">
      {parts.map((p, i) =>
        p.kind === 'glyph' ? (
          <Glyph key={i} name={p.key} class="sitelen-glyph" />
        ) : p.kind === 'name' ? (
          <Cartouche key={i} name={p.name} keys={p.keys} />
        ) : (
          <span key={i} class="sitelen-break" />
        ),
      )}
    </span>
  );
}
