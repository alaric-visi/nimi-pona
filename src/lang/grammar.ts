import { clauses, tokenize, type Token } from './tokenize';
import { phonoIssues } from './phonotactics';

export const PARTICLES = new Set(['li', 'e', 'la', 'pi', 'o', 'en', 'anu']);
export const PREPOSITIONS = new Set(['lon', 'tawa', 'tan', 'sama', 'kepeken', 'poka']);
export const PREVERBS = new Set(['wile', 'sona', 'awen', 'kama', 'ken', 'lukin', 'open', 'pini', 'alasa']);
/** Preverbs that stay preverbs before tawa/lon/…: "mi wile tawa" = I want to go. (awen/kama + lon/tan are main verbs.) */
const PREVERB_BEFORE_PREPOSITION = new Set(['wile', 'ken', 'sona', 'alasa', 'lukin', 'open', 'pini']);
const BARE_SUBJECTS = new Set(['mi', 'sina']);
/** Words that modify a verb rather than being one: "mi sona mute" = I know a lot. */
const NOT_A_VERB = new Set(['mute', 'lili', 'kin', 'taso', 'a', 'ala']);

/** A clause-initial "taso" (but) is a conjunction, not part of the subject. */
const stripConjunction = (clause: Token[]): Token[] =>
  clause[0]?.kind === 'word' && clause[0].text === 'taso' && clause.length > 1 ? clause.slice(1) : clause;
const PRONOUNS = new Set(['mi', 'sina', 'ona']);

export type Concept =
  | 'li' | 'e' | 'pi' | 'la' | 'o' | 'en' | 'anu'
  | 'negation' | 'question' | 'preverb' | 'preposition' | 'number' | 'name';

export interface LintIssue {
  rule: 'unknown-word' | 'name-phonotactics' | 'li-after-bare-subject' | 'pi-single-word' | 'ala-placement' | 'en-joins-predicate';
  message: string;
}

const w = (t: Token | undefined) => (t && t.kind !== 'punct' ? t.text : undefined);
const isContent = (t: Token | undefined) =>
  !!t && t.kind !== 'punct' && !PARTICLES.has(t.text);

/** Index where the predicate starts in a clause, or -1 (e.g. a `la` context or fragment). */
const SUBJECT_EXTENDERS = new Set(['mute', 'taso', 'kin', 'ale', 'tu', 'wan']);

function predicateStart(clause: Token[]): number {
  const marker = clause.findIndex((t) => t.kind === 'word' && (t.text === 'li' || t.text === 'o'));
  const byMarker = marker === -1 ? -1 : marker + 1;
  const first = w(clause[0]);
  const second = w(clause[1]);
  if (!first || !BARE_SUBJECTS.has(first) || !second) return byMarker;
  // "mi en sina li …", "mi li …" (an error, linted separately)
  if (PARTICLES.has(second)) return byMarker;
  // "mi mute li …", "mi taso li …": the subject is longer than bare mi/sina
  if (SUBJECT_EXTENDERS.has(second) && marker !== -1) return byMarker;
  // bare subject: "mi pona", "mi moku e kili", "sina wile tawa seme?"
  return 1;
}

/**
 * Content lint: catches the classic learner errors in authored sentences.
 * `dictionary` is every known word id (all tiers).
 */
export function lintSentence(text: string, dictionary: ReadonlySet<string>): LintIssue[] {
  const issues: LintIssue[] = [];
  const tokens = tokenize(text);

  for (const t of tokens) {
    if (t.kind === 'word' && !dictionary.has(t.text)) {
      issues.push({ rule: 'unknown-word', message: `"${t.text}" is not a known word` });
    }
    if (t.kind === 'name' && phonoIssues(t.text).length) {
      issues.push({ rule: 'name-phonotactics', message: `name "${t.text}" breaks Toki Pona sound rules` });
    }
  }

  for (const clause of clauses(tokens).map(stripConjunction)) {
    const first = w(clause[0]);
    if (first && BARE_SUBJECTS.has(first) && w(clause[1]) === 'li') {
      issues.push({ rule: 'li-after-bare-subject', message: `no "li" after a bare "${first}" subject` });
    }
    if (first && PRONOUNS.has(first) && w(clause[1]) === 'ala' && isContent(clause[2])) {
      issues.push({ rule: 'ala-placement', message: `"ala" goes after the word it negates: "${first} ${w(clause[2])} ala"` });
    }

    clause.forEach((t, i) => {
      if (w(t) === 'pi') {
        let n = 0;
        for (let j = i + 1; j < clause.length && isContent(clause[j]); j++) n++;
        if (n < 2) issues.push({ rule: 'pi-single-word', message: '"pi" must be followed by two or more words' });
      }
    });

    const ps = predicateStart(clause);
    if (ps !== -1) {
      for (let i = ps; i < clause.length; i++) {
        if (w(clause[i]) === 'en') {
          issues.push({ rule: 'en-joins-predicate', message: '"en" only joins subjects; repeat "e" or "li" instead' });
          break;
        }
      }
    }
  }
  return issues;
}

/** Grammar concepts a sentence exercises — used to tag the corpus for lessons. */
export function conceptsIn(text: string): Concept[] {
  const tokens = tokenize(text);
  const found = new Set<Concept>();
  if (tokens.some((t) => t.kind === 'punct' && t.text === '?')) found.add('question');
  for (const t of tokens) {
    if (t.kind === 'name') found.add('name');
    if (t.kind !== 'word') continue;
    if (['li', 'e', 'pi', 'la', 'o', 'en', 'anu'].includes(t.text)) found.add(t.text as Concept);
    if (t.text === 'ala') found.add('negation');
    if (t.text === 'seme') found.add('question');
    if (['nanpa', 'wan', 'tu', 'luka'].includes(t.text)) found.add('number');
  }
  for (const clause of clauses(tokens).map(stripConjunction)) {
    const ps = predicateStart(clause);
    if (ps !== -1) {
      const head = w(clause[ps]);
      // skip a negation and an "X ala X" repetition to find the verb a preverb would govern
      let i = ps + 1;
      if (w(clause[i]) === 'ala') i++;
      if (head && w(clause[i]) === head) {
        found.add('question');
        i++;
      }
      const next = w(clause[i]);
      if (head && PREVERBS.has(head) && next && isContent(clause[i]) && !NOT_A_VERB.has(next)) {
        if (!PREPOSITIONS.has(next) || PREVERB_BEFORE_PREPOSITION.has(head)) found.add('preverb');
      }
    }
    clause.forEach((t, i) => {
      if (i > 0 && t.kind === 'word' && PREPOSITIONS.has(t.text) && isContent(clause[i + 1]) && ps !== -1 && i >= ps) {
        found.add('preposition');
      }
    });
  }
  return [...found];
}

const ADVANCED: Concept[] = ['pi', 'la', 'preverb', 'en', 'anu'];
const INTERMEDIATE: Concept[] = ['e', 'preposition', 'negation', 'question', 'number', 'o'];

/** 1 (starter) – 3 (harder), from length and grammar load. */
export function difficulty(text: string): 1 | 2 | 3 {
  const words = tokenize(text).filter((t) => t.kind !== 'punct').length;
  const concepts = conceptsIn(text);
  const score =
    words +
    2 * concepts.filter((c) => ADVANCED.includes(c)).length +
    concepts.filter((c) => INTERMEDIATE.includes(c)).length;
  return score <= 4 ? 1 : score <= 8 ? 2 : 3;
}
