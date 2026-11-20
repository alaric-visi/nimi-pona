import { useEffect, useRef } from 'preact/hooks';

/** About & credits: where the language, data, script and code come from. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} class="dialog" aria-labelledby="about-title" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div class="dialog-body about">
        <h2 id="about-title" class="dialog-title">
          About <span lang="tok">nimi pona</span>
        </h2>
        <p>
          A calm way to learn <span lang="tok">toki pona</span>: its words, its grammar and its script, <span lang="tok">sitelen pona</span>. Everything runs
          in your browser; your progress stays on this device unless you export it.
        </p>

        <h3 class="dialog-section-title">The language</h3>
        <ul class="credits">
          <li>
            <span lang="tok">toki pona</span> was created by <b>Sonja Lang</b>. The official book is <cite>Toki Pona: The Language of Good</cite> (2014,
            known as <span lang="tok">pu</span>); <cite>Toki Pona Dictionary</cite> (2021, <span lang="tok">ku</span>) records community usage.
            This app is an independent learning tool, not affiliated with either book.
          </li>
          <li>Word glosses, example sentences, lessons and stories were written for this app and checked automatically for grammar and vocabulary.</li>
        </ul>

        <h3 class="dialog-section-title">Type and glyphs</h3>
        <ul class="credits">
          <li>
            <span lang="tok">sitelen pona</span> glyphs: <b>nasin nanpa</b> by jan Itan — MIT licence.
          </li>
          <li>
            <b>Fraunces</b> (Undercase Type) and <b>Atkinson Hyperlegible</b> (Braille Institute) — SIL Open Font Licence, via Fontsource.
          </li>
        </ul>

        <h3 class="dialog-section-title">Methods and code</h3>
        <ul class="credits">
          <li>
            Spaced repetition: <b>FSRS</b> via <b>ts-fsrs</b> (open-spaced-repetition) — MIT.
          </li>
          <li>
            Glyph tracing: the <b>$P point-cloud recogniser</b> (Vatavu, Anthony &amp; Wobbrock, ICMI 2012).
          </li>
          <li>
            Built with <b>Preact</b> (MIT), <b>@preact/signals</b> (MIT), <b>idb-keyval</b> (Apache 2.0) and <b>Vite</b> (MIT). Full licence texts:{' '}
            <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener">third-party notices</a>.
          </li>
        </ul>

        <h3 class="dialog-section-title">Keep going</h3>
        <ul class="credits">
          <li>
            The community dictionary <b>Linku</b> (linku.la), the wiki <b>sona pona</b> (sona.pona.la), jan Misali's video course <cite>12 days of sona pi toki pona</cite> and
            the magazine <cite>lipu tenpo</cite> are wonderful next steps.
          </li>
        </ul>

        <button type="button" class="btn btn-primary" onClick={onClose}>
          <span lang="tok">pona</span> · Close
        </button>
      </div>
    </dialog>
  );
}
