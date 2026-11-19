import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** Development mocks (VITE_MOCKS=true); requests without a handler reach the real API. */
export async function startMocks(): Promise<void> {
  await setupWorker(...handlers).start({ onUnhandledFrame: 'bypass', quiet: true });
}
