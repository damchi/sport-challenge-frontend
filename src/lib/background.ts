// Long enough for the first page to be up and its data asked for.
const BACKGROUND_DELAY_MS = 3000;

/**
 * Runs the task in the background: some time after the start, once the device
 * is idle, so that it never competes with the first page. Safari has no idle
 * callback: the delay alone.
 */
export function inBackground(task: () => void): () => void {
  let cancelIdle = () => {};
  const timer = globalThis.setTimeout(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(task, { timeout: 5000 });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      task();
    }
  }, BACKGROUND_DELAY_MS);
  return () => {
    globalThis.clearTimeout(timer);
    cancelIdle();
  };
}
