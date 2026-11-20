/**
 * A tiny, calm sound palette synthesised with Web Audio: no files to load.
 * Soft wooden/chime-like tones: a sine partial plus a quieter octave, with a fast
 * attack and an exponential decay. Off by default; the learner opts in.
 */

export type Cue = 'correct' | 'wrong' | 'complete';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, at: number, dur: number, gain: number) {
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  out.connect(ac.destination);
  for (const [mult, level, type] of [
    [1, 1, 'sine'],
    [2, 0.25, 'sine'],
    [3, 0.06, 'triangle'],
  ] as const) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}

// Pentatonic (D major) so any combination sounds consonant.
const D5 = 587.33;
const FSHARP5 = 739.99;
const A5 = 880;
const A3 = 220;

export function play(cue: Cue): void {
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  if (cue === 'correct') {
    tone(ac, D5, t, 0.35, 0.09);
    tone(ac, A5, t + 0.08, 0.5, 0.07);
  } else if (cue === 'wrong') {
    tone(ac, A3, t, 0.3, 0.08);
  } else {
    tone(ac, D5, t, 0.5, 0.08);
    tone(ac, FSHARP5, t + 0.12, 0.5, 0.07);
    tone(ac, A5, t + 0.24, 0.9, 0.07);
  }
}
