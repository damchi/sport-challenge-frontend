import '@testing-library/jest-dom/vitest';
import { initI18n, loadLanguage } from './i18n';
import { addAdminTranslations } from './i18n/admin';
import { server } from './mocks/server';

// Tests read the French texts; the English ones are there for the tests that
// switch to them.
await initI18n('fr');
await loadLanguage('en');
// The admin parts are tested without the page that brings their texts.
addAdminTranslations();

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
