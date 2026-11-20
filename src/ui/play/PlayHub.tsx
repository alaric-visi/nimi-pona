import { openPlay, readToday, today } from '../../app/play';
import { srs } from '../../app/learn';
import { actions } from '../../app/store';
import { PUZZLES } from '../../data/puzzles';
import { practiceCalendar } from '../../engine/play';
import { Glyph } from '../components/Glyph';
import { Garden } from './Garden';

function Calendar() {
  const days = practiceCalendar(srs.value, new Date(), 4);
  const count = days.filter((d) => d.practised).length;
  return (
    <figure class="calendar">
      <div class="calendar-grid" role="img" aria-label={`Practised on ${count} of the last 28 days.`}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={`h${i}`} class="calendar-head" aria-hidden="true">
            {d}
          </span>
        ))}
        {days.map((d) => (
          <span
            key={d.key}
            class={`calendar-day ${d.practised ? 'is-practised' : ''} ${d.today ? 'is-today' : ''} ${d.date > new Date() ? 'is-future' : ''}`}
            title={d.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
          />
        ))}
      </div>
      <figcaption class="garden-caption">
        {count} practice {count === 1 ? 'day' : 'days'} in the last four weeks. Rest days are part of learning.
      </figcaption>
    </figure>
  );
}

interface Tile {
  glyph: string;
  tp: string;
  title: string;
  blurb: string;
  go: () => void;
  badge?: string;
}

export function PlayHub() {
  const extras = srs.value.extras;
  const tiles: Tile[] = [
    {
      glyph: 'suno',
      tp: 'toki pi tenpo suno',
      title: 'Daily sentence',
      blurb: readToday.value ? 'Read today — come back tomorrow.' : `Today: ${today.value.tok}`,
      go: () => openPlay({ kind: 'daily' }),
      badge: readToday.value ? '✓' : undefined,
    },
    {
      glyph: 'tenpo',
      tp: 'tenpo lili',
      title: 'Speed round',
      blurb: extras.speedBest ? `60 seconds. Your best: ${extras.speedBest}.` : '60 seconds, as many words as you can.',
      go: () => openPlay({ kind: 'speed' }),
    },
    {
      glyph: 'nimi',
      tp: 'nimi sina',
      title: 'Your name',
      blurb: 'Turn any name into toki pona and sitelen pona.',
      go: () => openPlay({ kind: 'names' }),
    },
    {
      glyph: 'kulupu',
      tp: 'o nimi e ni',
      title: 'Compound puzzles',
      blurb: `Describe things the toki pona way. ${extras.puzzles.length}/${PUZZLES.length} solved.`,
      go: () => openPlay({ kind: 'puzzles' }),
    },
    {
      glyph: 'sitelen',
      tp: 'sitelen',
      title: 'Glyph tracing',
      blurb: `Draw sitelen pona by hand. ${Object.keys(extras.traced).length} glyphs drawn.`,
      go: () => openPlay({ kind: 'trace' }),
    },
    {
      glyph: 'lipu',
      tp: 'lipu',
      title: 'Free practice',
      blurb: 'Cards, quiz and recall by topic — no scheduling.',
      go: () => actions.setMode('flash'),
    },
  ];

  return (
    <section class="play" aria-labelledby="play-title">
      <h2 id="play-title" class="visually-hidden">
        Play
      </h2>
      <Garden />
      <ul class="play-tiles">
        {tiles.map((t) => (
          <li key={t.title}>
            <button type="button" class="play-tile" onClick={t.go}>
              <Glyph name={t.glyph} class="play-tile-glyph" />
              <span class="play-tile-text">
                <span class="play-tile-tp" lang="tok">
                  {t.tp}
                </span>
                <span class="play-tile-title">{t.title}</span>
                <span class="play-tile-blurb">{t.blurb}</span>
              </span>
              {t.badge && (
                <span class="play-tile-badge" aria-label="done today">
                  {t.badge}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <Calendar />
    </section>
  );
}
