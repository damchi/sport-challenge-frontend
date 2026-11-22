import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether the window matches a media query, kept up to date when it is
 * resized. False where the browser has no matchMedia (tests), so the phone
 * layout, the base of the styles, is the fallback.
 */
export function useMediaQuery(query: string): boolean {
  // Stable per query: a new one would subscribe again at each render.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
}
