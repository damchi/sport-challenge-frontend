import { reportError } from './errorTracking';

/**
 * Registers the service worker of the installable app (public/sw.js), once
 * the page has loaded so it does not compete with it. Production only: in
 * development the mock worker of MSW holds the scope.
 */
export function startServiceWorker(container: ServiceWorkerContainer | undefined): void {
  if (!container) return;
  // Without it, the app works as before: nothing to show the user, but a
  // worker the host serves wrong is worth knowing.
  const register = () => {
    container.register('/sw.js').catch(reportError);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
