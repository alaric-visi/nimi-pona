import { useEffect, useRef, useState } from 'preact/hooks';
import { learnActions, voiceReady } from '../../app/learn';
import { actions, settings } from '../../app/store';
import { WORDS } from '../../data/words';
import type { ScriptPref } from '../../app/persist';
import { Glyph } from './Glyph';

const SCRIPTS: { id: ScriptPref; label: string; hint: string }[] = [
  { id: 'both', label: 'sitelen pona + Latin', hint: 'Glyph with the word underneath' },
  { id: 'glyphs', label: 'sitelen pona only', hint: 'Reading practice: the Latin word appears with the answer' },
  { id: 'latin', label: 'Latin only', hint: 'No glyphs' },
];

const kuCount = WORDS.filter((w) => w.tier === 'ku').length;

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const s = settings.value;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      class="dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div class="dialog-body">
        <h2 id="settings-title" class="dialog-title">
          Settings
        </h2>

        <fieldset class="dialog-section">
          <legend class="dialog-section-title">Writing</legend>
          <div class="script-options">
            {SCRIPTS.map((o) => (
              <label class="script-option" key={o.id}>
                <input
                  type="radio"
                  name="script"
                  value={o.id}
                  checked={s.script === o.id}
                  onChange={() => actions.setScript(o.id)}
                />
                <span class="script-preview" aria-hidden="true">
                  {o.id !== 'latin' && <Glyph name="toki" />}
                  {o.id !== 'glyphs' && <span lang="tok">toki</span>}
                </span>
                <span class="toggle-text">
                  <span class="toggle-label">{o.label}</span>
                  <span class="toggle-hint">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset class="dialog-section">
          <legend class="dialog-section-title">Words</legend>

        <label class="toggle">
          <input
            type="checkbox"
            checked={s.includeKu}
            onChange={(e) => actions.setContent({ includeKu: e.currentTarget.checked })}
          />
          <span class="toggle-text">
            <span class="toggle-label">Include words beyond pu</span>
            <span class="toggle-hint">
              Adds {kuCount} widely used community words from <i>ku</i> (2021), like{' '}
              <span lang="tok">kijetesantakalu</span> and <span lang="tok">tonsi</span>.
            </span>
          </span>
        </label>

        <label class="toggle">
          <input
            type="checkbox"
            checked={s.includeSensitive}
            onChange={(e) => actions.setContent({ includeSensitive: e.currentTarget.checked })}
          />
          <span class="toggle-text">
            <span class="toggle-label">Include adult vocabulary</span>
            <span class="toggle-hint">
              pu includes <span lang="tok">unpa</span> (sex). It's left out of games unless you turn this on.
            </span>
          </span>
        </label>

        <p class="dialog-note">Changing words starts a new round.</p>
        </fieldset>

        <fieldset class="dialog-section">
          <legend class="dialog-section-title">Learning</legend>
          <label class="field-row">
            <span class="toggle-text">
              <span class="toggle-label">New words per day</span>
              <span class="toggle-hint">Reviews always come first; new words fill the rest.</span>
            </span>
            <select
              class="select"
              value={String(s.newPerDay)}
              onChange={(e) => actions.setLearning({ newPerDay: Number(e.currentTarget.value) })}
            >
              {[3, 5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label class="toggle">
            <input
              type="checkbox"
              checked={s.listening && voiceReady.value}
              disabled={!voiceReady.value}
              onChange={(e) => actions.setLearning({ listening: e.currentTarget.checked })}
            />
            <span class="toggle-text">
              <span class="toggle-label">Listening exercises</span>
              <span class="toggle-hint">
                {voiceReady.value
                  ? 'Uses a Spanish voice, respelled so it pronounces toki pona correctly.'
                  : 'No Spanish or Italian voice is available in this browser.'}
              </span>
            </span>
          </label>
        </fieldset>

        <ProgressSection />

        <fieldset class="dialog-section">
          <legend class="dialog-section-title">Sound</legend>
          <label class="toggle">
            <input type="checkbox" checked={s.sound} onChange={(e) => actions.setSound(e.currentTarget.checked)} />
            <span class="toggle-text">
              <span class="toggle-label">Soft feedback tones</span>
              <span class="toggle-hint">Quiet chimes for right, wrong and round complete.</span>
            </span>
          </label>
        </fieldset>

        <button type="button" class="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}

function ProgressSection() {
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const exportFile = () => {
    const url = URL.createObjectURL(learnActions.exportProgress());
    const a = document.createElement('a');
    a.href = url;
    a.download = `nimi-pona-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Progress exported.');
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      learnActions.importProgress(await f.text());
      setMessage('Progress imported.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not read that file.');
    }
    if (file.current) file.current.value = '';
  };

  const reset = async () => {
    if (!confirm('Erase all learning progress on this device? This cannot be undone. (Export first to keep a copy.)')) return;
    await learnActions.resetProgress();
    setMessage('Progress erased.');
  };

  return (
    <fieldset class="dialog-section">
      <legend class="dialog-section-title">Progress</legend>
      <p class="dialog-note">Saved in this browser only. Export a file to back it up or move it to another device.</p>
      <div class="progress-actions">
        <button type="button" class="btn" onClick={exportFile}>
          Export
        </button>
        <button type="button" class="btn" onClick={() => file.current?.click()}>
          Import…
        </button>
        <button type="button" class="btn btn-danger" onClick={reset}>
          Reset
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          class="visually-hidden"
          tabIndex={-1}
          aria-label="Import a progress file"
          onChange={(e) => importFile(e.currentTarget.files?.[0])}
        />
      </div>
      {message && (
        <p class="dialog-note" role="status">
          {message}
        </p>
      )}
    </fieldset>
  );
}
