import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Auth } from '../../lib/auth/auth';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ProfileAccount } from './ProfileAccount';

function renderAccount(overrides: Partial<Auth> = {}) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' }, ...overrides });
  const router = createMemoryRouter([{ path: '/me', element: <ProfileAccount /> }], {
    initialEntries: ['/me'],
  });
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return auth;
}

describe('ProfileAccount', () => {
  it('signs out', async () => {
    const auth = renderAccount();

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  });

  it('says when the sign-out could not start, and lets it be tried again', async () => {
    const signOut = vi.fn<Auth['signOut']>().mockRejectedValueOnce(new Error('offline'));
    signOut.mockResolvedValue(undefined);
    renderAccount({ signOut });

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
