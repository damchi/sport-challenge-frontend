import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Auth } from '../../lib/auth/auth';
import { createFakeAuth } from '../../test/fakeAuth';
import { FakeAuthProvider } from '../../test/FakeAuthProvider';
import { SignInCallback } from './SignInCallback';

function renderCallback(auth: Auth) {
  const router = createMemoryRouter(
    [
      { path: '/callback', element: <SignInCallback /> },
      { path: '/', element: <p>home</p> },
    ],
    { initialEntries: ['/callback'] },
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

    expect(screen.getByText("La connexion n'a pas abouti. Réessaie.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  it('opens the home page when already signed in', () => {
    renderCallback(createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|123' } }));

    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
