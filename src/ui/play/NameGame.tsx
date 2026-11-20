import { useEffect, useRef, useState } from 'preact/hooks';
import { adaptName } from '../../lang/names';
import { cartoucheFor, glyphFor, GLYPH_FRAME } from '../../data/glyphs';
import { voiceAvailable } from '../../app/learn';
import { speak } from '../../app/speech';
import { Cartouche, Glyph } from '../components/Glyph';
import { PlayBack } from './PlayView';

const HEADS = [
  { id: 'jan', label: 'a person' },
  { id: 'ma', label: 'a place' },
  { id: 'toki', label: 'a language' },
] as const;

/** Draw the name card to a canvas: cartouche of glyphs + Latin, on paper. */
async function renderCard(head: string, name: string): Promise<Blob | null> {
  const keys = [head, ...cartoucheFor(name)];
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const css = getComputedStyle(document.documentElement);
  const paper = css.getPropertyValue('--paper-raised').trim() || '#fbf8f1';
  const ink = css.getPropertyValue('--ink').trim() || '#1d2433';
  const accent = css.getPropertyValue('--accent').trim() || '#b0412b';
  g.fillStyle = paper;
  g.fillRect(0, 0, W, H);

  // glyph row: head word, then the cartouche
  const size = Math.min(150, (W - 240) / (keys.length + 0.8));
  const scale = size / GLYPH_FRAME.w;
  const rowW = size * keys.length + size * 0.5;
  let x = (W - rowW) / 2;
  const y = 170;
  g.fillStyle = ink;
  keys.forEach((k, i) => {
    const glyph = glyphFor(k);
    if (!glyph) return;
    g.save();
    g.translate(x, y - GLYPH_FRAME.y * scale);
    g.scale(scale, scale);
    g.fill(new Path2D(glyph.d));
    g.restore();
    x += size + (i === 0 ? size * 0.5 : 0);
  });
  // cartouche outline around everything after the head word
  const cx = (W - rowW) / 2 + size * 1.5 - size * 0.18;
  const cw = size * (keys.length - 1) + size * 0.36;
  const ch = size * (GLYPH_FRAME.h / GLYPH_FRAME.w) + size * 0.2;
  g.strokeStyle = ink;
  g.lineWidth = 7;
  g.beginPath();
  g.roundRect(cx, y - size * 0.1, cw, ch, ch / 2);
  g.stroke();

  await document.fonts.ready;
  g.textAlign = 'center';
  g.fillStyle = ink;
  g.font = '500 92px "Fraunces Variable", Georgia, serif';
  g.fillText(`${head} ${name}`, W / 2, 470);
  g.fillStyle = accent;
  g.font = '34px "Atkinson Hyperlegible", system-ui, sans-serif';
  g.fillText('nimi mi lon toki pona · nimi pona', W / 2, 545);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export function NameGame() {
  const [input, setInput] = useState('');
  const [head, setHead] = useState<(typeof HEADS)[number]['id']>('jan');
  const [chosen, setChosen] = useState(0);
  const [message, setMessage] = useState('');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus({ preventScroll: true }), []);

  const options = input.trim() ? adaptName(input) : [];
  const name = options[Math.min(chosen, options.length - 1)];

  const share = async () => {
    if (!name) return;
    const blob = await renderCard(head, name);
    if (!blob) return;
    const file = new File([blob], `${head}-${name}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${head} ${name}` });
        return;
      } catch {
        /* cancelled — fall through to download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Image saved.');
  };

  return (
    <article class="game" aria-labelledby="names-title">
      <PlayBack />
      <h2 id="names-title" class="unit-title">
        <span lang="tok">nimi sina</span> <span class="unit-title-en">Your name in toki pona</span>
      </h2>
      <p class="checkpoint-intro">
        Names from other languages are reshaped to Toki Pona's 14 sounds and written with a capital letter. This works from
        spelling — if your name sounds different from how it's spelled, try typing it the way it sounds.
      </p>
      <label class="name-input">
        <span class="visually-hidden">Your name</span>
        <input
          ref={field}
          class="typed-input"
          placeholder="Type a name…"
          value={input}
          maxLength={30}
          autocomplete="off"
          onInput={(e) => {
            setInput(e.currentTarget.value);
            setChosen(0);
            setMessage('');
          }}
        />
      </label>
      <div class="segmented segmented-3 segmented-sub" role="group" aria-label="What is it the name of?">
        {HEADS.map((h) => (
          <button key={h.id} type="button" class="segment" aria-pressed={head === h.id} onClick={() => setHead(h.id)}>
            <span lang="tok">{h.id}</span>&nbsp;· {h.label}
          </button>
        ))}
      </div>

      {name && (
        <>
          <div class="name-card" aria-live="polite">
            <span class="name-sitelen" aria-hidden="true" style={{ '--n': cartoucheFor(name).length + 1 }}>
              <Glyph name={head} class="name-head-glyph" />
              <Cartouche name={name} keys={cartoucheFor(name)} />
            </span>
            <span class="name-latin" lang="tok">
              {head} {name}
            </span>
            {voiceAvailable() && (
              <button type="button" class="btn" onClick={() => speak(`${head} ${name}`)}>
                Hear it
              </button>
            )}
          </div>
          {options.length > 1 && (
            <div class="name-options" role="group" aria-label="Other spellings">
              {options.map((o, i) => (
                <button key={o} type="button" class="chip" aria-pressed={i === chosen} onClick={() => setChosen(i)}>
                  <span lang="tok">{o}</span>
                </button>
              ))}
            </div>
          )}
          <p class="dialog-note">
            Each glyph in the cartouche stands for its word's first letter:{' '}
            {cartoucheFor(name).map((k, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                <span lang="tok">{k}</span> = {k[0].toUpperCase()}
              </span>
            ))}
          </p>
          <div class="checkpoint-actions">
            <button type="button" class="btn btn-primary" onClick={share}>
              Save as an image
            </button>
          </div>
          {message && <p class="dialog-note" role="status">{message}</p>}
        </>
      )}
      {input.trim() && !name && <p class="dialog-note">No letters Toki Pona can use — try spelling it the way it sounds.</p>}
    </article>
  );
}
