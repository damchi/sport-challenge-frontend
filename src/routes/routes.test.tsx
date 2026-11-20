import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
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
  it('renders the home page title on /', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Défis' })).toBeInTheDocument();
  });

  it('opens the challenge creation on /challenges/new', async () => {
    renderAt('/challenges/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Créer un défi' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Informations' })).toBeInTheDocument();
  });

  it('opens the activity entry from the home page', async () => {
    renderAt('/');
    const add = await screen.findByRole('link', { name: 'Ajouter une activité' });
    expect(add).toHaveAttribute('href', '/activities/new');
    fireEvent.click(add);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ajouter une activité' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Sport' })).toBeInTheDocument();
  });

  it('opens the activity entry from the activities page', async () => {
    renderAt('/activities');
    const add = await screen.findByRole('link', { name: 'Ajouter une activité' });
    expect(add).toHaveAttribute('href', '/activities/new');
    fireEvent.click(add);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ajouter une activité' }),
    ).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in, back to the requested page', () => {
    const auth = createFakeAuth();
    renderAt('/does-not-exist?tab=ranking', auth);

    expect(auth.signIn).toHaveBeenCalledWith('/does-not-exist?tab=ranking');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('shows no challenge to a signed-out visitor of the home page', () => {
    const auth = createFakeAuth();
    renderAt('/', auth);

    expect(auth.signIn).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publics' })).not.toBeInTheDocument();
  });

  it('keeps /callback public', () => {
    const auth = createFakeAuth();
    renderAt('/callback', auth);

    expect(screen.getByText('Connecte-toi pour continuer.')).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('renders the not found page on an unknown path', async () => {
    renderAt('/does-not-exist');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/');
  });
});
