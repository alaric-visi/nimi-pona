import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/**
 * Load a screen's code on first use (Preact core has no lazy()). The service worker
 * precaches every chunk, so this costs nothing offline — it only trims first load.
 */
export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  let Loaded: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  const start = () => (pending ??= load().then((c) => void (Loaded = c)));

  return function LazyScreen(props: P) {
    const [, setReady] = useState(!!Loaded);
    useEffect(() => {
      if (!Loaded) void start().then(() => setReady(true));
    }, []);
    return Loaded ? <Loaded {...props} /> : <p class="learn-loading">…</p>;
  };
}
