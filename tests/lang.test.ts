import { describe, expect, it } from 'vitest';
import { clauses, tokenize, wordsIn } from '../src/lang/tokenize';
import { isValidWord, phonoIssues } from '../src/lang/phonotactics';
import { conceptsIn, difficulty, lintSentence } from '../src/lang/grammar';
import { fromTokiPona, toTokiPona } from '../src/lang/numbers';
import { adaptName } from '../src/lang/names';

const DICT = new Set(
  'a ala ale e en ijo jan jo kama kili la li lili lon mi moku mute ni o ona pan pi pona seme sina sona suli tawa telo tenpo toki tomo wile n ken lukin'.split(' '),
);
const rules = (s: string) => lintSentence(s, DICT).map((i) => i.rule);

describe('tokenize', () => {
  it('separates words, names and punctuation', () => {
    expect(tokenize('jan Sonja o, toki!').map((t) => t.kind)).toEqual(['word', 'name', 'word', 'punct', 'word', 'punct']);
  });
  it('treats ellipses as one token', () => {
    expect(tokenize('n... mi sona ala.').map((t) => t.text)).toEqual(['n', '...', 'mi', 'sona', 'ala', '.']);
  });
  it('splits clauses at la and sentence punctuation', () => {
    expect(clauses(tokenize('tenpo ni la mi moku. sina pona.')).map((c) => c.map((t) => t.text).join(' '))).toEqual([
      'tenpo ni la',
      'mi moku',
      'sina pona',
    ]);
  });
  it('lists distinct dictionary words only', () => {
    expect(wordsIn('jan Lisa li jan pona.')).toEqual(['jan', 'li', 'pona']);
  });
});

describe('phonotactics', () => {
  it.each(['toki', 'pona', 'kijetesantakalu', 'nanpa', 'sinpin', 'ona', 'a', 'n', 'Kanata', 'Sonja'])('accepts %s', (w) =>
    expect(isValidWord(w)).toBe(true),
  );
  it.each([
    ['ti', 'forbidden-sequence'],
    ['wuta', 'forbidden-sequence'],
    ['tonmi', 'forbidden-sequence'],
    ['kaal', 'bad-syllable'],
    ['bob', 'bad-letter'],
    ['akst', 'bad-syllable'],
  ])('rejects %s (%s)', (w, issue) => expect(phonoIssues(w)).toContain(issue));
});

describe('lintSentence', () => {
  it('passes good sentences', () => {
    for (const s of [
      'mi pona.',
      'mi en sina li toki.',
      'mi mute li moku.',
      'tomo pi jan pona mi li suli.',
      'tenpo ni la mi moku e kili e pan.',
      'mi sona ala e ni.',
      'jan Lisa o, toki!',
      'sina wile ala wile moku?',
    ]) {
      expect(lintSentence(s, DICT), s).toEqual([]);
    }
  });
  it('catches li after bare mi/sina', () => expect(rules('mi li pona.')).toContain('li-after-bare-subject'));
  it('catches li after bare subject after la', () =>
    expect(rules('tenpo ni la sina li pona.')).toContain('li-after-bare-subject'));
  it('catches li after bare subject after taso', () => expect(rules('taso mi li pona.')).toContain('li-after-bare-subject'));
  it('catches pi + one word', () => expect(rules('tomo pi telo li suli.')).toContain('pi-single-word'));
  it('catches misplaced ala', () => expect(rules('mi ala sona e ni.')).toContain('ala-placement'));
  it('catches en joining objects', () => expect(rules('mi moku e kili en pan.')).toContain('en-joins-predicate'));
  it('catches unknown words', () => expect(rules('mi moku e banana.')).toContain('unknown-word'));
  it('catches badly adapted names', () => expect(rules('mi jan Bob.')).toContain('name-phonotactics'));
});

describe('concepts and difficulty', () => {
  it('tags grammar', () => {
    expect(conceptsIn('mi wile moku e kili.')).toEqual(expect.arrayContaining(['e', 'preverb']));
    expect(conceptsIn('mi wile e kili.')).not.toContain('preverb');
    expect(conceptsIn('sina pona ala pona?')).toEqual(expect.arrayContaining(['question', 'negation']));
    expect(conceptsIn('mi lon tomo.')).toContain('preposition');
    expect(conceptsIn('mi wile tawa.')).toContain('preverb');
    expect(conceptsIn('mi awen lon tomo.')).not.toContain('preverb');
    expect(conceptsIn('mi sona ala e ni.')).not.toContain('preverb');
    expect(conceptsIn('mi ken ala moku.')).toContain('preverb');
    expect(conceptsIn('taso mi wile lape.')).toContain('preverb');
    expect(conceptsIn('jan li sona mute.')).not.toContain('preverb');
    expect(conceptsIn('tenpo ni la mi moku.')).toContain('la');
  });
  it('rates difficulty', () => {
    expect(difficulty('mi pona.')).toBe(1);
    expect(difficulty('tenpo ni la jan pi toki pona li wile moku e kili mute.')).toBe(3);
  });
});

describe('numbers', () => {
  it.each([
    [0, 'ala'],
    [1, 'wan'],
    [3, 'tu wan'],
    [4, 'tu tu'],
    [28, 'mute luka tu wan'],
    [100, 'ale'],
    [145, 'ale mute mute luka'],
  ])('%i ↔ %s', (n, tp) => {
    expect(toTokiPona(n)).toBe(tp);
    expect(fromTokiPona(tp)).toBe(n);
  });
  it('rejects out-of-order or unknown parts', () => {
    expect(fromTokiPona('wan tu')).toBeNull();
    expect(fromTokiPona('tu soweli')).toBeNull();
  });
  it('accepts ali as ale', () => expect(fromTokiPona('ali wan')).toBe(101));
});

describe('adaptName', () => {
  it('produces community-standard results for easy names', () => {
    expect(adaptName('Canada')[0]).toBe('Kanata');
    expect(adaptName('Lisa')[0]).toBe('Lisa');
    expect(adaptName('America')[0]).toBe('Amelika');
  });
  it.each(['Bob', 'Christopher', 'Steve', 'Edward', 'Ingrid', 'Zoë', 'Tim', 'Gwen', 'Jim', 'Anna-Marie', 'Xavier'])(
    'always returns valid Toki Pona for %s',
    (name) => {
      const out = adaptName(name);
      expect(out.length).toBeGreaterThan(0);
      for (const n of out) expect(isValidWord(n), n).toBe(true);
    },
  );
});
