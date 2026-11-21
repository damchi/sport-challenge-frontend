import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Auth } from '../lib/auth/auth';
import { createFakeAuth } from '../test/fakeAuth';
import { FakeAuthProvider } from '../test/FakeAuthProvider';
import { RequireAuth } from './RequireAuth';

function renderProtected(auth: Auth, path = '/challenges/42?tab=ranking#me') {
  const router = createMemoryRouter(
    [{ element: <RequireAuth />, children: [{ path: '*', element: <p>protected page</p> }] }],
    { initialEntries: [path] },
  );
  return render(
    <FakeAuthProvider auth={auth}>
      <RouterProvider router={router} />
    </FakeAuthProvider>,
  );
}

describe('RequireAuth', () => {
  it('shows the page to a signed-in user', () => {
    renderProtected(createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } }));

    expect(screen.getByText('protected page')).toBeInTheDocument();
  });

  it('waits while the session loads, without signing in', () => {
    const auth = createFakeAuth({ isLoading: true });
    renderProtected(auth);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('sends a signed-out user to sign in once, back to the requested page', () => {
    const auth = createFakeAuth();
    const { rerender } = renderProtected(auth);
    rerender(<FakeAuthProvider auth={auth}>{null}</FakeAuthProvider>);

    expect(auth.signIn).toHaveBeenCalledTimes(1);
    expect(auth.signIn).toHaveBeenCalledWith('/challenges/42?tab=ranking#me');
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('offers a retry when the redirect to Auth0 cannot start', async () => {
    const auth = createFakeAuth({ signIn: vi.fn(() => Promise.reject(new Error('offline'))) });
    renderProtected(auth);

    expect(await screen.findByRole('alert')).toHaveTextContent("La connexion n'a pas abouti.");
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  it('offers a retry instead of looping when the sign-in failed', () => {
    const auth = createFakeAuth({ hasError: true });
    renderProtected(auth);

    expect(auth.signIn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(auth.signIn).toHaveBeenCalledWith('/challenges/42?tab=ranking#me', {
      chooseAccount: true,
    });
  });

  describe('offline', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function goOnline(online: boolean) {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
      act(() => {
        window.dispatchEvent(new Event(online ? 'online' : 'offline'));
      });
    }

    it('waits for the connection to sign in', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const auth = createFakeAuth();
      renderProtected(auth);

      expect(
        screen.getByText('Tu pourras te connecter dès que tu seras de nouveau en ligne.'),
      ).toBeInTheDocument();
      expect(auth.signIn).not.toHaveBeenCalled();

      goOnline(true);

      expect(auth.signIn).toHaveBeenCalledWith('/challenges/42?tab=ranking#me');
    });

    it('keeps the page of a signed-in user', () => {
      renderProtected(createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } }));

      goOnline(false);

      expect(screen.getByText('protected page')).toBeInTheDocument();
    });
  });
});
