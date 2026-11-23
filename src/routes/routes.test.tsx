import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    const [first] = await screen.findAllByRole('link', { name: 'Modifier' });
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

  it('shows no challenge to a signed-out visitor of the home page', () => {
    const auth = createFakeAuth();
    renderAt('/', auth);

    expect(auth.signIn).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publics' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/');
  });
});
