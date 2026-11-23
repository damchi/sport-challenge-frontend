import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { AppProviders } from '../test/AppProviders';
import { createFakeAuth } from '../test/fakeAuth';
import { inBackground } from '../lib/background';
import { AppShell } from './AppShell';
import { preloadPages } from './pages';
import { routes } from './routes';

vi.mock('../lib/background', () => ({ inBackground: vi.fn() }));

function renderApp(path = '/challenges') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('application shell', () => {
  it('offers the three tabs and marks the current one', async () => {
    renderApp('/challenges');

    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Défis' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Activités' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/me');
  });

  it('navigates between tabs, with the page title and the focus on its heading', async () => {
    const router = renderApp('/challenges');

    fireEvent.click(await screen.findByRole('link', { name: 'Activités' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Mes activités' });
    expect(router.state.location.pathname).toBe('/activities');
    expect(screen.getByRole('link', { name: 'Activités' })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(heading).toHaveFocus());
    expect(document.title).toBe('Mes activités · Sport Challenge');
  });

  it('shows the translated 404 page inside the shell', async () => {
    renderApp('/does-not-exist');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(document.title).toBe('Page introuvable · Sport Challenge');
  });

  it('preloads the code of the other pages in the background', async () => {
    renderApp('/challenges');
    await screen.findByRole('navigation', { name: 'Navigation principale' });
    expect(inBackground).toHaveBeenCalledWith(preloadPages);
  });

  it('shows the loading state, under the navigation, while the code of the next page loads', async () => {
    let loaded: (page: { Component: () => ReactNode }) => void = () => undefined;
    const router = createMemoryRouter([
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <p>first page</p> },
          { path: '/next', lazy: () => new Promise((resolve) => (loaded = resolve)) },
        ],
      },
    ]);
    render(
      <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(screen.getByText('first page')).toBeInTheDocument();

    act(() => void router.navigate('/next'));
    expect(await screen.findByRole('status')).toHaveTextContent(/^Chargement…$/);
    expect(screen.queryByText('first page')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();

    await act(async () => loaded({ Component: () => <p>next page</p> }));
    expect(await screen.findByText('next page')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the page of a challenge while the code of one of its sections loads', async () => {
    let loaded: (section: { Component: () => ReactNode }) => void = () => undefined;
    const challenge = (
      <>
        <p>challenge header</p>
        <Outlet />
      </>
    );
    const router = createMemoryRouter(
      [
        {
          element: <AppShell />,
          children: [
            {
              path: '/challenges/:challengeId',
              element: challenge,
              children: [
                { index: true, element: <p>first section</p> },
                { path: 'participants', lazy: () => new Promise((resolve) => (loaded = resolve)) },
              ],
            },
          ],
        },
      ],
      { initialEntries: ['/challenges/a'] },
    );
    render(
      <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    act(() => void router.navigate('/challenges/a/participants'));
    await waitFor(() => expect(router.state.navigation.state).toBe('loading'));
    // The challenge page shows the wait below its header itself.
    expect(screen.getByText('challenge header')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await act(async () => loaded({ Component: () => <p>participants section</p> }));
    expect(await screen.findByText('participants section')).toBeInTheDocument();
  });

  it('keeps the page, with its state, on a navigation within it', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <AppShell />,
          children: [
            {
              path: '/page',
              lazy: () =>
                Promise.resolve({ Component: () => <input aria-label="draft" defaultValue="" /> }),
            },
          ],
        },
      ],
      { initialEntries: ['/page'] },
    );
    render(
      <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText('draft'), { target: { value: 'typed' } });
    const states: string[] = [];
    const unsubscribe = router.subscribe((state) => states.push(state.navigation.state));

    // Its code has loaded: a new query or fragment makes nothing wait.
    await act(() => router.navigate('/page?tab=2#part'));
    unsubscribe();

    expect(router.state.location.search).toBe('?tab=2');
    expect(states).not.toContain('loading');
    expect(screen.getByLabelText('draft')).toHaveValue('typed');
  });
});
