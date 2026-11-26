import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MainNav } from './MainNav';

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '*', element: <MainNav /> }], {
    initialEntries: [path],
  });
  render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  );
}

const activeTab = () =>
  screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);

describe('MainNav', () => {
  it.each([
    ['/challenges', 'nav.challenges'],
    ['/challenges/', 'nav.challenges'],
    ['/challenges/c1', 'nav.challenges'],
    ['/challenges/c1/participants', 'nav.challenges'],
    ['/challenges/new', 'nav.challenges'],
    ['/activities', 'nav.activities'],
    ['/activities/new', 'nav.activities'],
    ['/activities/a1/edit', 'nav.activities'],
    ['/me', 'nav.profile'],
    ['/admin', 'nav.profile'],
    ['/admin/users/u1', 'nav.profile'],
  ])('marks one tab as the current page on %s', (path, labelKey) => {
    renderAt(path);
    expect(activeTab()).toEqual([i18n.t(labelKey)]);
  });

  it.each(['/invite', '/challengesx', '/unknown'])('marks no tab on %s', (path) => {
    renderAt(path);
    expect(activeTab()).toEqual([]);
  });
});
