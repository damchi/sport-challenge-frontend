import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getConfig } from './lib/config';
import './styles/index.css';
import i18n from 'i18next';
import './i18n';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const root = createRoot(rootElement);

try {
  getConfig();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  // A configuration mistake (VITE_* variable): its detail is for the
  // developer, shown in development only; users get the generic message.
  // The error stays in the console either way.
  root.render(
    <main className="mx-auto max-w-page px-5 py-8">
      {import.meta.env.DEV ? (
        <pre className="whitespace-pre-wrap text-ink">{String(error)}</pre>
      ) : (
        <p className="text-ink">{i18n.t('errors.unknown_error')}</p>
      )}
    </main>,
  );
  throw error;
}
