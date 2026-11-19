import { useSyncExternalStore } from 'react';

// Theme of the app: the device's by default, or a choice kept on the device.
// It sets data-theme on <html>, which tokens.css reads; index.html sets it
// before the first paint with the same rules (no flash of the other theme).

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'sport-challenge:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

let choice: ThemeChoice = 'system';
let followingDevice = false;
const listeners = new Set<() => void>();

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

function apply(): void {
  const dark = choice === 'dark' || (choice === 'system' && prefersDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Reads the kept choice, applies it and follows the device while it is "system". */
export function startTheme(): void {
  choice = readChoice();
  apply();
  if (!followingDevice && typeof window.matchMedia === 'function') {
    window.matchMedia(DARK_QUERY).addEventListener('change', apply);
    followingDevice = true;
  }
}

export function setThemeChoice(next: ThemeChoice): void {
  choice = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // Storage unavailable: the choice lasts until the page closes.
  }
  apply();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => choice);
}
