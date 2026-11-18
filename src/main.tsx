import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getConfig } from './lib/config';
import './styles/index.css';
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
  // A configuration mistake (VITE_* variable) is for the developer: its
  // message is shown as is, in place of the app, and stays in the console.
  root.render(
    <main className="mx-auto max-w-page px-5 py-8">
      <pre className="whitespace-pre-wrap text-ink">{String(error)}</pre>
    </main>,
  );
  throw error;
}
