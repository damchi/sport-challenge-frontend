import '@testing-library/jest-dom/vitest';
import './i18n';
import { server } from './mocks/server';

// Every request of a test must have a handler: an unknown one fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
