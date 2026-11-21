import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { reportError } from '../lib/errorTracking';
import { AppProviders } from '../test/AppProviders';
import { createFakeAuth } from '../test/fakeAuth';
import { RouteError } from './RouteError';
import { routes } from './routes';

// The code of the profile page fails to load, as with no network.
vi.mock('./pages', async (importOriginal) => {
  const original = await importOriginal<typeof import('./pages')>();
  return {
    ...original,
    pages: {
      ...original.pages,
      profile: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
    },
  };
});

vi.mock('../lib/errorTracking', () => ({ reportError: vi.fn() }));

describe('RouteError', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the error page when the code of a page fails to load, and reloads on retry', async () => {
    const failure = new TypeError('Failed to fetch dynamically imported module');
    const router = createMemoryRouter([
      { path: '/', errorElement: <RouteError />, lazy: () => Promise.reject(failure) },
    ]);
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(
      <AppProviders auth={createFakeAuth()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: "Oups, cette page n'a pas pu s'afficher",
      }),
    ).toBeInTheDocument();
    // Reported by an effect, which may run just after the page shows.
    await waitFor(() => expect(reportError).toHaveBeenCalledWith(failure));

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(reload).toHaveBeenCalled();
  });

  it('keeps the main navigation above the error page of a signed-in page', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/me'] });
    render(
      <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: "Oups, cette page n'a pas pu s'afficher",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('aria-current', 'page');
  });
});
