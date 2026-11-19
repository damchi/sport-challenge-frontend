import type { ReauthGuard } from './useHandleLostSession';

const KEY = 'sport-challenge:reauth-at';
/** A lost session again within this delay after a re-sign-in means a loop. */
const LOOP_WINDOW_MS = 60_000;

/**
 * Time of the last automatic re-sign-in, kept in sessionStorage (a number,
 * no personal data) since the re-sign-in reloads the page. Without storage,
 * re-sign-in stays allowed.
 */
export function createReauthGuard(now: () => number = Date.now): ReauthGuard {
  return {
    allowed: () => {
      try {
        const at = Number(sessionStorage.getItem(KEY));
        return !at || now() - at > LOOP_WINDOW_MS;
      } catch {
        return true;
      }
    },
    record: () => {
      try {
        sessionStorage.setItem(KEY, String(now()));
      } catch {
        // Storage unavailable: no loop protection across reloads.
      }
    },
    forget: resetReauthGuard,
  };
}

/** Forgets the last re-sign-in: the user asked to try again. */
export function resetReauthGuard(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
