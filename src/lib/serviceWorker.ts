import { reportError } from './errorTracking';

/**
 * Registers the service worker of the installable app (public/sw.js), once
 * the page has loaded so it does not compete with it. Production only: in
 * development the mock worker of MSW holds the scope.
 */
export function startServiceWorker(container: ServiceWorkerContainer | undefined): void {
  if (!container) return;
  // First visit: the worker controls the page only once it has started.
  if (!container.controller) {
    container.addEventListener('controllerchange', keepLoadedAssets, { once: true });
  }
  // Without it, the app works as before: nothing to show the user, but a
  // worker the host serves wrong is worth knowing.
  const register = () => {
    container.register('/sw.js').catch(reportError);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/**
 * The files of /assets/ the page loaded before the worker controlled it,
 * asked again through it so that it keeps them for offline starts. The worker
 * keeps by itself those index.html names, not the ones loaded apart, such as
 * the language's texts. They come from the browser's cache.
 */
function keepLoadedAssets(): void {
  const files = new Set(
    performance
      .getEntriesByType('resource')
      .map(({ name }) => new URL(name))
      .filter((url) => url.origin === window.location.origin && url.pathname.startsWith('/assets/'))
      .map((url) => url.pathname),
  );
  // Nothing to tell the user: the next visit online keeps them anyway.
  for (const file of files) fetch(file).catch(() => undefined);
}
