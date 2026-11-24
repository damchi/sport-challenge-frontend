import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockMe } from '../mocks/handlers';
import { server } from '../mocks/server';
import { AppProviders } from '../test/AppProviders';
import { createFakeAuth } from '../test/fakeAuth';
import { ProfileGate } from './ProfileGate';
import { RequireAdmin } from './RequireAdmin';

// Counts the loads of the admin code.
const loaded = vi.hoisted(() => ({ count: 0 }));
vi.mock('../pages/AdminPage', () => {
  loaded.count += 1;
  return { AdminPage: () => <h1>Admin</h1> };
});

function renderAdmin() {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [{ element: <ProfileGate />, children: [{ path: '/admin', element: <RequireAdmin /> }] }],
    { initialEntries: ['/admin'] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('RequireAdmin', () => {
  it('never loads the admin code for anyone else', async () => {
    renderAdmin();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }),
    ).toBeInTheDocument();
    expect(loaded.count).toBe(0);
  });

  it('loads it for an admin', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, is_admin: true })));
    renderAdmin();

    expect(await screen.findByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument();
    expect(loaded.count).toBe(1);
  });
});
