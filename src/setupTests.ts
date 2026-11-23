import '@testing-library/jest-dom/vitest';
import { initI18n } from './i18n';
import { server } from './mocks/server';

// Tests read the French texts.
initI18n('fr');

// Every request of a test must have a handler: an unknown one fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // Choices kept on the device (list sizes) do not leak into the next test.
  localStorage.clear();
});
afterAll(() => server.close());

// jsdom has no modal dialog: open and close it, as a browser would.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
};
