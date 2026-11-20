import unitsRaw from '../../content/units.yaml';
import phrasesRaw from '../../content/phrases.yaml';
import compoundsRaw from '../../content/compounds.yaml';
import { wordsIn } from '../lang/tokenize';

export interface TextPair {
  tok: string;
  en: string;
}

export interface StoryLine extends TextPair {
  who?: string;
}

export interface Question {
  q: string;
  options: string[];
  /** index of the right option in `options` (shuffled for display) */
  answer: number;
}

export interface Unit {
  id: string;
  n: number;
  tp: string;
  title: string;
  focus: string;
  glyph: string;
  words: string[];
  optional?: boolean;
  lesson: { idea: string; points: string[]; examples: TextPair[] };
  checkpoint: { script?: 'glyphs'; lines: StoryLine[]; questions: Question[] };
}

export interface Phrase extends TextPair {
  unit: number;
}

function req<T>(cond: T, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function parseUnits(data: unknown): Unit[] {
  req(Array.isArray(data), 'units.yaml must be a list');
  const units = (data as Record<string, unknown>[]).map((u, i) => {
    const where = `units.yaml[${i}] (${u.id ?? '?'})`;
    for (const k of ['id', 'tp', 'title', 'focus', 'glyph'] as const) req(typeof u[k] === 'string', `${where}: missing ${k}`);
    req(typeof u.n === 'number', `${where}: missing n`);
    req(Array.isArray(u.words), `${where}: words must be a list`);
    const lesson = u.lesson as Unit['lesson'];
    req(lesson && typeof lesson.idea === 'string' && Array.isArray(lesson.points) && Array.isArray(lesson.examples), `${where}: bad lesson`);
    const cp = u.checkpoint as Unit['checkpoint'];
    req(cp && Array.isArray(cp.lines) && cp.lines.length > 0 && Array.isArray(cp.questions), `${where}: bad checkpoint`);
    for (const q of cp.questions) {
      req(Array.isArray(q.options) && q.answer >= 0 && q.answer < q.options.length, `${where}: bad question "${q.q}"`);
    }
    return u as unknown as Unit;
  });
  units.forEach((u, i) => req(u.n === i + 1, `units.yaml: unit ${u.id} should be number ${i + 1}`));
  return units;
}

export const UNITS: Unit[] = parseUnits(unitsRaw);
export const UNIT_BY_ID = new Map(UNITS.map((u) => [u.id, u]));
export const PHRASES = phrasesRaw as Phrase[];
export const COMPOUNDS = compoundsRaw as TextPair[];

/** The unit that introduces each word. */
export const UNIT_OF_WORD = new Map<string, Unit>(UNITS.flatMap((u) => u.words.map((w) => [w, u] as const)));

/** Words known by the end of unit n (cumulative). */
export function vocabularyThrough(n: number): Set<string> {
  return new Set(UNITS.filter((u) => u.n <= n).flatMap((u) => u.words));
}

/** Compounds that contain a word. */
export const compoundsWith = (wordId: string) => COMPOUNDS.filter((c) => wordsIn(c.tok).includes(wordId));
