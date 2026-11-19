import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../test/AppProviders';
import { createFakeAuth } from '../test/fakeAuth';
import { routes } from './routes';

function renderApp(path = '/') {
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
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Défis' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Activités' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/me');
  });

  it('navigates between tabs, with the page title and the focus on its heading', async () => {
    const router = renderApp('/');

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
});
