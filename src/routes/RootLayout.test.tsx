import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router';
import { mockMe } from '../mocks/handlers';
import { server } from '../mocks/server';
import { ApiError } from '../api/errors';
import { GlobalErrorContext } from '../lib/globalError';
import { createFakeAuth } from '../test/fakeAuth';
import { AppProviders } from '../test/AppProviders';
import { RootLayout } from './RootLayout';
import { routes } from './routes';

const signedIn = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });

function AppWithError({ path }: { path: string }) {
  const [error, setError] = useState<unknown>();
  const [router] = useState(() => createMemoryRouter(routes, { initialEntries: [path] }));
  const dismiss = useCallback(() => setError(undefined), []);
  const value = useMemo(() => ({ error, dismiss }), [error, dismiss]);

  return (
    <AppProviders auth={signedIn}>
      <GlobalErrorContext.Provider value={value}>
        <button type="button" onClick={() => setError(new ApiError('week_locked', 409))}>
          fail
        </button>
        <RouterProvider router={router} />
      </GlobalErrorContext.Provider>
    </AppProviders>
  );
}

describe('RootLayout', () => {
  it('shows the global error banner and hides it on navigation', async () => {
    render(<AppWithError path="/does-not-exist" />);
    // Once the code of the page has loaded.
    await screen.findByRole('heading', { level: 1, name: 'Page introuvable' });

    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('link', { name: "Retour à l'accueil" }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Défis' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes the banner with its button', () => {
    render(<AppWithError path="/challenges" />);

    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps what is below it mounted, with its state, across a navigation', async () => {
    let mounts = 0;
    function Shell() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        mounts += 1;
      }, []);
      return (
        <>
          <button type="button" onClick={() => setCount(count + 1)}>
            {`count ${count}`}
          </button>
          <Outlet />
        </>
      );
    }
    const router = createMemoryRouter(
      [
        {
          element: <RootLayout />,
          children: [
            {
              element: <Shell />,
              children: [
                { path: '/a', element: <Link to="/b">to b</Link> },
                { path: '/b', element: <p>page b</p> },
              ],
            },
          ],
        },
      ],
      { initialEntries: ['/a'] },
    );
    render(
      <AppProviders auth={signedIn}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'count 0' }));

    fireEvent.click(screen.getByRole('link', { name: 'to b' }));

    expect(await screen.findByText('page b')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'count 1' })).toBeInTheDocument();
    expect(mounts).toBe(1);
  });

  it('leaves the error page of a page that failed on navigation', async () => {
    // React logs the caught error; kept out of the test output.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Broken(): never {
      throw new Error('render failure');
    }
    const router = createMemoryRouter(
      [
        {
          element: <RootLayout />,
          children: [
            { path: '/broken', element: <Broken /> },
            {
              path: '/other',
              element: (
                <main>
                  <h1>Other page</h1>
                </main>
              ),
            },
          ],
        },
      ],
      { initialEntries: ['/broken'] },
    );
    render(
      <AppProviders auth={signedIn}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();

    await act(() => router.navigate('/other'));

    expect(screen.getByRole('heading', { level: 1, name: 'Other page' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('leaves the focus on the part chosen in the admin section', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, is_admin: true })));
    render(<AppWithError path="/admin" />);

    const nav = await screen.findByRole('navigation', { name: "Sections de l'administration" });
    const users = within(nav).getByRole('link', { name: 'Comptes' });
    users.focus();
    fireEvent.click(users);

    await waitFor(() => expect(users).toHaveAttribute('aria-current', 'page'));
    expect(users).toHaveFocus();
  });

  describe('focus within a page of sections', () => {
    function renderSections() {
      const page = (
        <main>
          <h1>Page</h1>
          <nav aria-label="sections">
            <Link to="/page">list</Link>
            <Link to="/page/other">other section</Link>
          </nav>
          <Outlet />
        </main>
      );
      const router = createMemoryRouter(
        [
          {
            element: <RootLayout />,
            children: [
              {
                path: '/page',
                element: page,
                handle: { titleKey: 'home.title', sections: true },
                children: [
                  { index: true, element: <Link to="/page/item">row</Link> },
                  { path: 'item', element: <p>detail</p> },
                  { path: 'other', element: <p>other</p> },
                ],
              },
              {
                path: '/elsewhere',
                element: (
                  <main>
                    <h1>Elsewhere</h1>
                  </main>
                ),
              },
            ],
          },
        ],
        { initialEntries: ['/page'] },
      );
      render(
        <AppProviders auth={signedIn}>
          <RouterProvider router={router} />
        </AppProviders>,
      );
      return router;
    }

    it('moves the focus to the title when the link followed is gone', async () => {
      renderSections();
      const row = screen.getByRole('link', { name: 'row' });
      row.focus();
      fireEvent.click(row);

      expect(await screen.findByText('detail')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Page' })).toHaveFocus();
    });

    it('leaves the focus alone after a click that gave it to no link (Safari)', async () => {
      renderSections();
      const section = screen.getByRole('link', { name: 'other section' });
      section.focus();
      section.blur();
      fireEvent.click(section);

      expect(await screen.findByText('other')).toBeInTheDocument();
      expect(document.body).toHaveFocus();
    });

    it('moves the focus to the title of another page', async () => {
      const router = renderSections();
      await act(() => router.navigate('/elsewhere'));

      expect(screen.getByRole('heading', { level: 1, name: 'Elsewhere' })).toHaveFocus();
    });
  });
});
