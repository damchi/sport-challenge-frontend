import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockMe } from '../mocks/handlers';
import { server } from '../mocks/server';
import type { Auth } from '../lib/auth/auth';
import { createFakeAuth } from '../test/fakeAuth';
import { AppProviders } from '../test/AppProviders';
import { routes } from './routes';

const signedIn = () => createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });

function renderAt(path: string, auth: Auth = signedIn()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('routes', () => {
  it('renders the challenges on /challenges', async () => {
    renderAt('/challenges');
    expect(await screen.findByRole('heading', { level: 1, name: 'Défis' })).toBeInTheDocument();
    // Adding an activity belongs to the activities page.
    expect(screen.queryByRole('link', { name: 'Ajouter une activité' })).not.toBeInTheDocument();
  });

  it('opens the challenge creation on /challenges/new', async () => {
    renderAt('/challenges/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Créer un défi' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Le défi' })).toBeInTheDocument();
  });

  it('opens the activity entry from the activities page, its first item', async () => {
    renderAt('/activities');
    const add = await screen.findByRole('link', { name: 'Ajouter une activité' });
    expect(add).toHaveAttribute('href', '/activities/new');
    // Before the activities.
    const [first] = await screen.findAllByRole('article');
    if (!first) throw new Error('No activity listed');
    expect(add.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(add);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ajouter une activité' }),
    ).toBeInTheDocument();

    // Back goes to the activities, not to the challenges.
    fireEvent.click(screen.getByRole('link', { name: 'Mes activités' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mes activités' }),
    ).toBeInTheDocument();
  });

  it('opens the change of an activity from the activities page', async () => {
    renderAt('/activities');
    // Edited from the "…" menu of an activity that can still change.
    const [menu] = await screen.findAllByRole('button', { name: "Actions de l'activité" });
    if (!menu) throw new Error('No activity to change');
    fireEvent.click(menu);
    const [first] = screen.getAllByRole('link', { name: 'Modifier' });
    if (!first) throw new Error('No activity to change');
    fireEvent.click(first);

    expect(
      await screen.findByRole('heading', { level: 1, name: "Modifier l'activité" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: 'Course' })).toBeChecked();
  });

  it('sends a signed-out visitor to sign in, back to the requested page', async () => {
    const auth = createFakeAuth();
    renderAt('/does-not-exist?tab=ranking', auth);

    // Once the code of the page has loaded.
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('/does-not-exist?tab=ranking'));
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('shows the landing page to a visitor of /, without signing in nor calling the API', async () => {
    const auth = createFakeAuth();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderAt('/', auth);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Défie tes amis, semaine après semaine.',
      }),
    ).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(auth.getAccessToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Publics' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Sport Challenge · Des défis sportifs entre amis'),
    );
    fetchSpy.mockRestore();
  });

  it('shows the landing page to a signed-in user too, with a link to the challenges', async () => {
    renderAt('/');

    expect(await screen.findByRole('link', { name: 'Mon compte' })).toHaveAttribute(
      'href',
      '/challenges',
    );
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('still signs a visitor in on a deep link, back to it', async () => {
    const auth = createFakeAuth();
    renderAt('/challenges/42', auth);

    // Once the code of the page has loaded.
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('/challenges/42'));
  });

  it('keeps /callback public', async () => {
    const auth = createFakeAuth();
    renderAt('/callback', auth);

    expect(await screen.findByText('Connecte-toi pour continuer.')).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('shows the loading state while the code of the first page loads', async () => {
    renderAt('/me');
    expect(screen.getByRole('status')).toHaveTextContent(/^Chargement…$/);
    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument();
  });

  it('renders the not found page on an unknown path', async () => {
    renderAt('/does-not-exist');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute(
      'href',
      '/challenges',
    );
  });

  describe('the admin section', () => {
    const asAdmin = () =>
      server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, is_admin: true })));

    it.each([
      ['/admin', 'Tableau de bord'],
      ['/admin/challenges', 'Défis'],
      ['/admin/challenges/c-1', 'Défis'],
      ['/admin/users', 'Comptes'],
      ['/admin/users/u-1', 'Comptes'],
      ['/admin/journal', 'Journal'],
    ])('opens %s to an admin, under its part', async (path, part) => {
      asAdmin();
      renderAt(path);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Administration' }),
      ).toBeInTheDocument();
      const parts = screen.getByRole('navigation', { name: "Sections de l'administration" });
      expect(within(parts).getByRole('link', { name: part })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await waitFor(() => expect(document.title).toBe(`${part} · Sport Challenge`));
    });

    it('goes from part to part', async () => {
      asAdmin();
      renderAt('/admin');
      // The page is drawn again at each address: the parts are looked up anew.
      const parts = () => screen.getByRole('navigation', { name: "Sections de l'administration" });
      await screen.findByRole('heading', { level: 1, name: 'Administration' });
      expect(
        within(parts())
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Tableau de bord', 'Défis', 'Comptes', 'Journal']);

      fireEvent.click(within(parts()).getByRole('link', { name: 'Journal' }));
      await waitFor(() =>
        expect(within(parts()).getByRole('link', { name: 'Journal' })).toHaveAttribute(
          'aria-current',
          'page',
        ),
      );
      expect(within(parts()).getByRole('link', { name: 'Tableau de bord' })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('shows the not found page to anyone else', async () => {
      renderAt('/admin/users');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Administration')).not.toBeInTheDocument();
      expect(document.title).toBe('Page introuvable · Sport Challenge');
    });

    it('sends a signed-out visitor to sign in first', async () => {
      const auth = createFakeAuth();
      renderAt('/admin', auth);

      await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('/admin'));
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    });
  });
});
