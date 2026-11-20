import { useEffect, useState } from 'preact/hooks';
import { AboutDialog } from './components/AboutDialog';
import { announcement, done, settings } from '../app/store';
import { handleKey } from '../app/keyboard';
import { Header } from './components/Header';
import { CategoryChips, ModeSwitch, NavSwitch, Progress } from './components/Controls';
import { lazyScreen } from './lazy';

// Play and the Dictionary load on first visit; Learn (the default screen) ships in the main bundle.
const PlayView = lazyScreen(() => import('./play/PlayView').then((m) => m.PlayView));
const Dictionary = lazyScreen(() => import('./dict/Dictionary').then((m) => m.Dictionary));
import { openPlay } from '../app/play';
import { actions } from '../app/store';
import { FlashCard } from './components/FlashCard';
import { Quiz } from './components/Quiz';
import { DoneScreen } from './components/DoneScreen';
import { LearnView } from './learn/LearnView';

export function App() {
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const mode = settings.value.mode;
  const [about, setAbout] = useState(false);

  return (
    <div class="shell">
      <Header />
      <nav class="controls" aria-label="Practice settings">
        <NavSwitch />
        {mode !== 'learn' && mode !== 'dict' && mode !== 'play' && (
          <>
            <button
              type="button"
              class="link-btn back-link"
              onClick={() => {
                openPlay({ kind: 'hub' });
                actions.setMode('play');
              }}
            >
              ← <span lang="tok">musi</span>
            </button>
            <ModeSwitch />
            <CategoryChips />
          </>
        )}
      </nav>
      <main class="main">
        {mode === 'learn' ? (
          <LearnView />
        ) : mode === 'dict' ? (
          <Dictionary />
        ) : mode === 'play' ? (
          <PlayView />
        ) : done.value ? (
          <DoneScreen />
        ) : (
          <>
            <Progress />
            {mode === 'quiz' ? <Quiz /> : <FlashCard />}
          </>
        )}
      </main>
      <footer class="footer">
        <p>
          <span lang="tok">toki pona</span> was created by Sonja Lang ·{' '}
          <cite>Toki Pona: The Language of Good</cite> (2014)
        </p>
        <p>
          <span lang="tok">sitelen pona</span> glyphs from <span lang="tok">nasin nanpa</span> by jan Itan (MIT licence) ·{' '}
          <button type="button" class="link-btn" onClick={() => setAbout(true)}>
            About &amp; credits
          </button>
        </p>
        {['flash', 'quiz', 'rev'].includes(mode) && <p class="footer-keys" aria-hidden="true">
          Keys: <kbd>space</kbd> flip · <kbd>1</kbd>/<kbd>2</kbd> grade · <kbd>1</kbd>–<kbd>4</kbd> answer ·{' '}
          <kbd>enter</kbd> continue
        </p>}
      </footer>
      <AboutDialog open={about} onClose={() => setAbout(false)} />
      <div class="visually-hidden" role="status" aria-live="polite">
        {announcement.value}
      </div>
    </div>
  );
}
