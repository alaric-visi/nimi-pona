import { actions, done, session, settings } from './store';
import { quizResult } from '../engine/session';

/**
 * Global shortcuts:
 *   flash / rev — Space/Enter flip, 1 or ← missed, 2 or → got it
 *   quiz        — 1–4 choose, Enter/Space/→ continue after answering
 * Space/Enter on a focused button are left to the browser so they act on that button.
 */
export function handleKey(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (done.value) return;
  if (document.querySelector('dialog[open]')) return;
  if (!['flash', 'quiz', 'rev'].includes(settings.value.mode)) return; // other sections handle their own keys

  const onButton = !!target?.closest('button');
  const activate = (e.key === ' ' || e.key === 'Enter') && !onButton;
  const s = session.value;

  const handled = (() => {
    if (s.mode === 'quiz') {
      if (/^[1-4]$/.test(e.key) && s.quiz && !s.quiz.chosen) {
        const opt = s.quiz.options[Number(e.key) - 1];
        if (opt) actions.answer(opt.id);
        return true;
      }
      if ((activate || e.key === 'ArrowRight') && quizResult(s)) {
        actions.advance();
        return true;
      }
      return false;
    }
    if (activate) {
      actions.flip();
      return true;
    }
    if (s.revealed && (e.key === '1' || e.key === 'ArrowLeft')) {
      actions.grade(false);
      return true;
    }
    if (s.revealed && (e.key === '2' || e.key === 'ArrowRight')) {
      actions.grade(true);
      return true;
    }
    return false;
  })();

  if (handled) e.preventDefault();
}
