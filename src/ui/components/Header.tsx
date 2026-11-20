import { useState } from 'preact/hooks';
import { actions, pool, settings } from '../../app/store';
import { SettingsDialog } from './SettingsDialog';
import { Glyph } from './Glyph';
import type { ThemePref } from '../../app/persist';

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemePref, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

function ThemeIcon({ theme }: { theme: ThemePref }) {
  // suno (sun) / mun (moon) / half disc for "follow system"
  if (theme === 'light')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      </svg>
    );
  if (theme === 'dark')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" class="fill" />
    </svg>
  );
}

export function Header() {
  const theme = settings.value.theme;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const s = settings.value;
  const scope = s.includeKu ? 'pu + ku' : 'nimi pu';
  return (
    <header class="header">
      <div class="brand">
        <h1 class="wordmark">
          <span lang="tok">nimi pona</span>
          <span class="seal" aria-hidden="true">
            <Glyph name="pona" />
          </span>
        </h1>
        <p class="tagline">
          Toki Pona vocabulary · {pool.value.length} words · <span lang="tok">{scope}</span>
        </p>
      </div>
      <div class="header-actions">
      <button
        type="button"
        class="icon-btn"
        onClick={() => setSettingsOpen(true)}
        aria-haspopup="dialog"
        aria-label="Settings"
        title="Settings"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
        <span class="icon-btn-label">Settings</span>
      </button>
      <button
        type="button"
        class="icon-btn"
        onClick={() => actions.setTheme(NEXT[theme])}
        aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}.`}
        title={`Theme: ${LABEL[theme]}`}
      >
        <ThemeIcon theme={theme} />
        <span class="icon-btn-label">{LABEL[theme]}</span>
      </button>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
