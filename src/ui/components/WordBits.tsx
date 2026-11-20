import { ROLE_LABEL, type Word } from '../../data/words';
import { examplesFor } from '../../data/sentences';
import { hiddenWords, settings } from '../../app/store';
import type { ScriptPref } from '../../app/persist';
import { Glyph, SitelenText } from './Glyph';

/** Shared word presentation pieces. All render as <span>s so they can live inside a <button>. */

export function Meta({ w }: { w: Word }) {
  return (
    <span class="card-meta">
      <span>{w.roles.map((r) => ROLE_LABEL[r]).join(' / ')}</span>
      <span aria-hidden="true">·</span>
      <span>{w.themes[0]}</span>
      <TierBadge w={w} />
    </span>
  );
}

export function TierBadge({ w }: { w: Word }) {
  if (w.tier === 'pu') return null;
  const label = w.tier === 'ku' ? 'ku · community word' : `pu synonym of ${w.synonyms?.join(', ')}`;
  return <span class="tier-badge">{label}</span>;
}

/**
 * The word as a prompt: big glyph and/or Latin, per the writing setting.
 * Changing `drawKey` remounts the glyph, replaying the ink animation; omit it for a static glyph.
 */
export function WordHero({ w, script, drawKey }: { w: Word; script: ScriptPref; drawKey?: string }) {
  if (script === 'latin') {
    return (
      <span class="card-word" lang="tok">
        {w.id}
      </span>
    );
  }
  return (
    <span class={`word-hero ${script === 'glyphs' ? 'is-glyph-only' : ''}`}>
      <Glyph key={drawKey ?? 'static'} name={w.glyph} draw={drawKey !== undefined} class="hero-glyph" />
      {script === 'both' && (
        <span class="card-word card-word-under" lang="tok">
          {w.id}
        </span>
      )}
    </span>
  );
}

/** The word on the answer side: always Latin (so glyph-only readers see the answer), glyph beside it. */
export function WordLine({ w, script }: { w: Word; script: ScriptPref }) {
  return (
    <span class="word-line">
      {script !== 'latin' && <Glyph name={w.glyph} class="line-glyph" />}
      <span class="card-word card-word-sm" lang="tok">
        {w.id}
      </span>
    </span>
  );
}

/** Glosses that add something beyond the concept line. */
export function Glosses({ w, max = 6 }: { w: Word; max?: number }) {
  const concept = w.concept.toLowerCase();
  const extra = w.glosses.filter((g) => !concept.includes(g.toLowerCase())).slice(0, max);
  if (!extra.length) return null;
  return (
    <span class="card-glosses">
      <span class="card-small-label">also</span> {extra.join(', ')}
    </span>
  );
}

export function Examples({ w, limit = 2 }: { w: Word; limit?: number }) {
  const examples = examplesFor(w.id, limit, { excludeWords: hiddenWords.value });
  if (!examples.length) return null;
  return (
    <span class="examples">
      {examples.map((s) => (
        <span class="example" key={s.tok}>
          {settings.value.script !== 'latin' && <SitelenText text={s.tok} class="example-sitelen" />}
          <span class="example-tok" lang="tok">
            {s.tok}
          </span>
          <span class="example-en">{s.en}</span>
        </span>
      ))}
    </span>
  );
}

export function Note({ w }: { w: Word }) {
  if (!w.notes) return null;
  return <span class="card-note">{w.notes}</span>;
}
