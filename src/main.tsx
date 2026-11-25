import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getConfig } from './lib/config';
import { reportError, startErrorTracking } from './lib/errorTracking';
import './styles/index.css';
import i18n from 'i18next';
import { startLanguage } from './lib/language';
import { startServiceWorker } from './lib/serviceWorker';
import { startTheme } from './lib/theme';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// Before anything renders, the error screen below included: its texts are
// downloaded first, so no screen shows a raw key.
await startLanguage();
startTheme();
// React's own error hooks: a crash of the tree, or an error an error boundary
// caught. Setting them replaces React's console output, kept here.
function onReactError(error: unknown): void {
  console.error(error);
  reportError(error);
}
const root = createRoot(rootElement, {
  onUncaughtError: onReactError,
  onCaughtError: onReactError,
});

// Development mocks, before the first request; the DEV guard removes them, and
// msw, from the production bundle.
async function startMocks(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === 'true') {
    const mocks = await import('./mocks/browser');
    await mocks.startMocks();
  }
}

try {
  const config = getConfig();
  // Not awaited: the SDK loads apart and the errors raised meanwhile wait for it.
  void startErrorTracking({ dsn: config.sentryDsn, dev: import.meta.env.DEV });
  if (import.meta.env.PROD) {
    startServiceWorker('serviceWorker' in navigator ? navigator.serviceWorker : undefined);
  }
  await startMocks();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  // A configuration mistake (VITE_* variable): its detail is for the
  // developer, shown in development only; users get a generic message.
  // The error stays in the console either way.
  root.render(
    <main className="mx-auto w-full max-w-page px-5 py-8 lg:max-w-wide lg:px-8">
      {import.meta.env.DEV ? (
        <pre className="whitespace-pre-wrap text-ink">{String(error)}</pre>
      ) : (
        <p className="text-ink">{i18n.t('errors.app_unavailable')}</p>
      )}
    </main>,
  );
  throw error;
}
