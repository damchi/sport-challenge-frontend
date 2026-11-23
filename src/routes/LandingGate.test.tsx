import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Auth } from '../lib/auth/auth';
import { createFakeAuth } from '../test/fakeAuth';
import { AppProviders } from '../test/AppProviders';
import { LandingGate } from './LandingGate';

function renderGate(auth: Auth, path = '/') {
  const router = createMemoryRouter(
    [{ element: <LandingGate />, children: [{ path: '*', element: <p>protected page</p> }] }],
    { initialEntries: [path] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

const LANDING_TITLE = 'Défie tes amis, semaine après semaine.';

describe('LandingGate', () => {
  it('shows the landing page to a visitor of /', async () => {
    renderGate(createFakeAuth());

    expect(
      await screen.findByRole('heading', { level: 1, name: LANDING_TITLE }),
    ).toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('goes on to the app for a signed-in user', () => {
    renderGate(createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } }));

    expect(screen.getByText('protected page')).toBeInTheDocument();
  });

  it('goes on to the app for a user who signed in on this device', () => {
    renderGate(createFakeAuth({ isReturning: true }));

    expect(screen.getByText('protected page')).toBeInTheDocument();
  });

  it('goes on to the app after a failed sign-in, which offers a retry there', () => {
    renderGate(createFakeAuth({ hasError: true }));

    expect(screen.getByText('protected page')).toBeInTheDocument();
  });

  it('waits while the session loads, without showing the landing page', () => {
    renderGate(createFakeAuth({ isLoading: true }));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: LANDING_TITLE })).not.toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('leaves every other path to the app', () => {
    renderGate(createFakeAuth(), '/challenges/42');

    expect(screen.getByText('protected page')).toBeInTheDocument();
  });
});
