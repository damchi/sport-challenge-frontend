import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Auth } from '../lib/auth/auth';
import { createFakeAuth } from '../test/fakeAuth';
import { FakeAuthProvider } from '../test/FakeAuthProvider';
import { routes } from './routes';

const signedIn = () => createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });

function renderAt(path: string, auth: Auth = signedIn()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FakeAuthProvider auth={auth}>
      <RouterProvider router={router} />
    </FakeAuthProvider>,
  );
}

describe('routes', () => {
  it('renders the home page title on /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Sport Challenge' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in, back to the requested page', () => {
    const auth = createFakeAuth();
    renderAt('/does-not-exist?tab=ranking', auth);

    expect(auth.signIn).toHaveBeenCalledWith('/does-not-exist?tab=ranking');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('keeps /callback public', () => {
    const auth = createFakeAuth();
    renderAt('/callback', auth);

    expect(screen.getByText('Connecte-toi pour continuer.')).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('renders the not found page on an unknown path', () => {
    renderAt('/does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/');
  });
});
