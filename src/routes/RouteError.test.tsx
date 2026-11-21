import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { reportError } from '../lib/errorTracking';
import { AppProviders } from '../test/AppProviders';
import { createFakeAuth } from '../test/fakeAuth';
import { RouteError } from './RouteError';

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
    expect(reportError).toHaveBeenCalledWith(failure);

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(reload).toHaveBeenCalled();
  });
});
