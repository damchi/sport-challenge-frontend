import { useSyncExternalStore } from 'react';

// Whether the device has a network connection, as the browser reports it.
// "Online" does not promise the server answers: requests keep their own errors.

function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}
