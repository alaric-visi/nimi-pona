/**
 * Toki Pona pronunciation through the browser's speech synthesis.
 *
 * There are no Toki Pona voices, but its five pure vowels and simple consonants are
 * very close to Spanish. Two adjustments make a Spanish voice say it correctly:
 *   - Toki Pona "j" is English "y"; Spanish "j" is a throat sound → spell it "y"
 *   - Toki Pona stresses the FIRST syllable; Spanish stresses the second-to-last
 *     → for words of 3+ syllables, put a written accent on the first vowel (kálama)
 * Italian is the fallback (also close; "j" → "i").
 * This is a stopgap until human recordings exist (PLAN.md, Phase 3/6).
 */

const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
const syllables = (w: string) => (w.match(/[aeiou]/g) ?? []).length;

export function forSpanishVoice(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    let w = word.toLowerCase().replace(/j/g, 'y');
    if (syllables(w) >= 3) w = w.replace(/[aeiou]/, (v) => ACUTE[v]);
    return w;
  });
}

export function forItalianVoice(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => word.toLowerCase().replace(/j/g, 'i'));
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const by = (prefix: string) => voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  return by('es-es') ?? by('es') ?? by('it') ?? null;
}

/** Voices load asynchronously in some browsers; resolve once we know. */
export function speechReady(): Promise<boolean> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve(false);
  cachedVoice = pickVoice();
  if (cachedVoice) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      cachedVoice = pickVoice();
      resolve(!!cachedVoice);
    };
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

export const speechAvailable = () => !!cachedVoice;

export function speak(text: string, rate = 0.85): void {
  const voice = cachedVoice ?? pickVoice();
  if (!voice) return;
  speechSynthesis.cancel();
  const spanish = voice.lang.toLowerCase().startsWith('es');
  const u = new SpeechSynthesisUtterance(spanish ? forSpanishVoice(text) : forItalianVoice(text));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  speechSynthesis.speak(u);
}
