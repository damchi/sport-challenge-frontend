import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Auth } from '../../lib/auth/auth';
import { createFakeAuth } from '../../test/fakeAuth';
import { FakeAuthProvider } from '../../test/FakeAuthProvider';
import { SignInCallback } from './SignInCallback';

function renderCallback(auth: Auth, path = '/callback') {
  const router = createMemoryRouter(
    [
      { path: '/callback', element: <SignInCallback /> },
      { path: '/challenges', element: <p>home</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <FakeAuthProvider auth={auth}>
      <RouterProvider router={router} />
    </FakeAuthProvider>,
  );
}

describe('SignInCallback', () => {
  it('announces the sign-in in progress', () => {
    renderCallback(createFakeAuth({ isLoading: true }));

    expect(screen.getByRole('status')).toHaveTextContent('Connexion en cours…');
  });

  it('offers to sign in again when the sign-in failed', () => {
    const auth = createFakeAuth({ hasError: true });
    renderCallback(auth);

    expect(screen.getByRole('alert')).toHaveTextContent("La connexion n'a pas abouti. Réessaie.");
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    // A declined sign-in must not bring the same account back.
    expect(auth.signIn).toHaveBeenCalledWith(undefined, { chooseAccount: true });
  });

  it('asks to sign in when opened directly while signed out', () => {
    const auth = createFakeAuth();
    renderCallback(auth);

    expect(screen.getByText('Connecte-toi pour continuer.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  it('leaves the requested page to the provider when back from sign-in', () => {
    renderCallback(
      createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|123' } }),
      '/callback?code=abc&state=xyz',
    );

    expect(screen.getByRole('status')).toHaveTextContent('Connexion en cours…');
    expect(screen.queryByText('home')).not.toBeInTheDocument();
  });

  it('shows a failure when the redirect to Auth0 cannot start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const auth = createFakeAuth({
      signIn: vi.fn(() => Promise.reject(new Error('insecure origin'))),
    });
    renderCallback(auth);

    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "La connexion n'a pas abouti. Réessaie.",
    );
  });

  it('opens the home page when opened directly while signed in', () => {
    renderCallback(createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|123' } }));

    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
