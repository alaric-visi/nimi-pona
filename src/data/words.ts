import raw from '../../content/words.yaml';

export const TIERS = ['pu', 'pu-synonym', 'ku'] as const;
export type Tier = (typeof TIERS)[number];

export const ROLES = ['content', 'particle', 'pronoun', 'preverb', 'preposition', 'number', 'interjection'] as const;
export type Role = (typeof ROLES)[number];

/** Topics, in display order. 'all' is the no-filter option. */
export const TOPICS = [
  'all', 'people', 'body', 'animals', 'nature', 'food', 'objects', 'places', 'colours',
  'qualities', 'actions', 'mind', 'senses', 'communication', 'position', 'time', 'numbers', 'grammar',
] as const;
export type Topic = (typeof TOPICS)[number];

export interface Word {
  id: string;
  tier: Tier;
  roles: Role[];
  themes: Exclude<Topic, 'all'>[];
  concept: string;
  glosses: string[];
  synonyms?: string[];
  variants?: string[];
  notes?: string;
  sensitive?: boolean;
  /** sitelen pona asset key (Phase 2) */
  glyph: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  content: 'content word',
  particle: 'particle',
  pronoun: 'pronoun',
  preverb: 'preverb',
  preposition: 'preposition',
  number: 'number',
  interjection: 'interjection',
};

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Validate words.yaml at load time so content mistakes fail loudly. */
export function parseWords(data: unknown): Word[] {
  if (!Array.isArray(data)) throw new Error('words.yaml must be a list');
  const seen = new Set<string>();
  const words = data.map((d, i) => {
    const w = d as Record<string, unknown>;
    const where = `words.yaml[${i}]${typeof w.id === 'string' ? ` (${w.id})` : ''}`;
    for (const key of ['id', 'tier', 'concept'] as const) {
      if (typeof w[key] !== 'string' || !w[key]) throw new Error(`${where}: missing "${key}"`);
    }
    for (const key of ['roles', 'themes', 'glosses'] as const) {
      if (!isStringArray(w[key]) || !(w[key] as string[]).length) throw new Error(`${where}: "${key}" must be a non-empty list`);
    }
    const id = w.id as string;
    if (seen.has(id)) throw new Error(`${where}: duplicate id`);
    seen.add(id);
    if (!(TIERS as readonly string[]).includes(w.tier as string)) throw new Error(`${where}: unknown tier "${w.tier}"`);
    for (const r of w.roles as string[]) if (!(ROLES as readonly string[]).includes(r)) throw new Error(`${where}: unknown role "${r}"`);
    for (const t of w.themes as string[]) {
      if (t === 'all' || !(TOPICS as readonly string[]).includes(t)) throw new Error(`${where}: unknown theme "${t}"`);
    }
    for (const key of ['synonyms', 'variants'] as const) {
      if (w[key] !== undefined && !isStringArray(w[key])) throw new Error(`${where}: "${key}" must be a list`);
    }
    return { ...w, glyph: (w.glyph as string | undefined) ?? id } as Word;
  });
  for (const w of words) {
    for (const s of w.synonyms ?? []) if (!seen.has(s)) throw new Error(`words.yaml (${w.id}): unknown synonym "${s}"`);
  }
  return words;
}

export const WORDS: Word[] = parseWords(raw);
export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));
/** Every known word id plus spelling variants — used by the content linter. */
export const DICTIONARY: ReadonlySet<string> = new Set(WORDS.flatMap((w) => [w.id, ...(w.variants ?? [])]));

export interface PoolOptions {
  includeKu: boolean;
  includeSensitive: boolean;
}

/** Words available for games under the learner's settings. */
export function wordPool(words: readonly Word[], opts: PoolOptions): Word[] {
  return words.filter((w) => (opts.includeKu || w.tier !== 'ku') && (opts.includeSensitive || !w.sensitive));
}

export function inTopic(w: Word, topic: string): boolean {
  return topic === 'all' || (w.themes as string[]).includes(topic);
}
