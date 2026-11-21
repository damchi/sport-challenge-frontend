/**
 * Registers the service worker of the installable app (public/sw.js), once
 * the page has loaded so it does not compete with it. Production only: in
 * development the mock worker of MSW holds the scope.
 */
export function startServiceWorker(container: ServiceWorkerContainer | undefined): void {
  if (!container) return;
  // Without it, the app works as before: nothing to show the user.
  const register = () => {
    container.register('/sw.js').catch((error: unknown) => console.warn(error));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
