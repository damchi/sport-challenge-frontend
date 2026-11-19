import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * While `active`, leaving the page is held back: a move inside the app is
 * blocked until the returned blocker proceeds or resets (the caller asks the
 * user), and closing or reloading the tab gets the browser's own warning.
 */
export function useLeaveWarning(active: boolean) {
  const blocker = useBlocker(active);

  useEffect(() => {
    if (!active) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  return blocker;
}
