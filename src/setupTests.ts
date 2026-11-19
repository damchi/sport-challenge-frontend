import '@testing-library/jest-dom/vitest';
import { initI18n } from './i18n';
import { server } from './mocks/server';

// Tests read the French texts.
initI18n('fr');

// Every request of a test must have a handler: an unknown one fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
