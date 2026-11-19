import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getConfig } from './lib/config';
import './styles/index.css';
import i18n from 'i18next';
import { startLanguage } from './lib/language';
import { startTheme } from './lib/theme';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// Before anything renders: the error screen below is translated too.
startLanguage();
startTheme();
const root = createRoot(rootElement);

// Development mocks, before the first request; the DEV guard removes them, and
// msw, from the production bundle.
async function startMocks(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === 'true') {
    const mocks = await import('./mocks/browser');
    await mocks.startMocks();
  }
}

try {
  getConfig();
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
