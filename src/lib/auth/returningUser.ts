// Whether someone signed in on this device and did not sign out since. Kept
// on the device (a flag, never a token or an identity): after a reload, the
// session in memory is gone, and when the browser blocks Auth0's silent
// sign-in (Safari, an installed app), the landing page would offer « Se
// connecter » to a known user. With the flag, it offers « Mon compte ».

const KEY = 'sport-challenge:returning';

export function isReturningUser(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberReturningUser(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Storage refused (private mode...): « Se connecter » after a reload.
  }
}

export function forgetReturningUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing kept.
  }
}
