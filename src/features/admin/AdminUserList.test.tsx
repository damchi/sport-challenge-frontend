import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockAdminUsers } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminUserList } from './AdminUserList';

function renderList() {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [
      { path: '/admin/users', element: <AdminUserList /> },
      { path: '/admin/users/:userId', element: <p>Sheet</p> },
    ],
    { initialEntries: ['/admin/users'] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** The searches the list sent: their address and body, in order. */
function recordSearches() {
  const searches: { url: URL; body: unknown }[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname !== '/api/v1/admin/users/search') return;
    void request
      .clone()
      .json()
      .then((body: unknown) => searches.push({ url, body }));
  });
  return searches;
}

const rows = async () => {
  const table = await screen.findByRole('table', { name: 'Tous les comptes' });
  // The header row left out.
  return within(table).getAllByRole('row').slice(1);
};

const row = async (index: number) => {
  const found = (await rows())[index];
  if (!found) throw new Error(`No row ${index}`);
  return within(found);
};

// The device's time zone, fixed: the times below are Montreal's.
beforeEach(() => {
  const options = Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone: 'America/Montreal',
  });
});
afterEach(() => vi.restoreAllMocks());

beforeEach(() => localStorage.clear());
afterEach(() => server.events.removeAllListeners());

describe('AdminUserList', () => {
  it('lists the accounts in a table, each linked to its sheet', async () => {
    renderList();

    const first = await row(0);
    expect(first.getByRole('link', { name: 'marie_92' })).toHaveAttribute(
      'href',
      `/admin/users/${mockAdminUsers[0]?.id ?? ''}`,
    );
    expect(first.getByText('marie@example.com')).toBeInTheDocument();
    expect(first.getByText('Actif')).toBeInTheDocument();
    expect(first.getByText('20 nov. 2026')).toBeInTheDocument();
    expect(first.getByText('19 nov. 2026')).toBeInTheDocument();
    expect(first.getByText('24')).toBeInTheDocument();
    // No pseudo: the names; no activity yet.
    const second = await row(1);
    expect(second.getByRole('link', { name: 'Ami 1' })).toBeInTheDocument();
    expect(second.getByText('Aucune')).toBeInTheDocument();
  });

  it('shows the state of each account in a pill', async () => {
    renderList();

    const deleted = await row(2);
    expect(deleted.getByRole('link', { name: 'Compte supprimé' })).toBeInTheDocument();
    expect(deleted.getByText('Supprimé')).toBeInTheDocument();
    expect((await row(3)).getByText('Suppression Auth0 en attente')).toBeInTheDocument();
  });

  it('sends the search in the body, never in the address', async () => {
    const searches = recordSearches();
    const router = renderList();
    await rows();

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Rechercher un compte par pseudo, nom ou e-mail' }),
      { target: { value: '  ami5@EXAMPLE.com ' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByRole('link', { name: 'ami_5' })).toBeInTheDocument();
    expect(await rows()).toHaveLength(1);
    const last = searches.at(-1);
    expect(last?.body).toEqual({ q: 'ami5@EXAMPLE.com', limit: 10 });
    expect(last?.url.search).toBe('');
    expect(router.state.location.search).toBe('');
    expect(router.state.location.hash).toBe('');
  });

  it('says when no account matches, and clears the search', async () => {
    renderList();
    await rows();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'personne' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(
      await screen.findByText('Aucun compte ne correspond à cette recherche.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
    expect(await rows()).toHaveLength(10);
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('reads the next page on "load more", with the cursor', async () => {
    const searches = recordSearches();
    renderList();
    expect(await rows()).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));

    await screen.findByRole('link', { name: 'ami_19' });
    expect(await rows()).toHaveLength(20);
    expect(searches.at(-1)?.body).toEqual({ limit: 10, cursor: '10' });
  });

  it('reads every page once "all" is chosen', async () => {
    renderList();
    await rows();

    fireEvent.click(screen.getByRole('radio', { name: 'Tout' }));

    await screen.findByRole('link', { name: 'ami_23' });
    expect(await rows()).toHaveLength(24);
  });

  it('says when there is no account at all', async () => {
    server.use(
      http.post('*/api/v1/admin/users/search', () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    );
    renderList();

    expect(await screen.findByText("Aucun compte pour l'instant.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).not.toBeInTheDocument();
  });

  it('shows the error and reloads on retry', async () => {
    server.use(
      http.post(
        '*/api/v1/admin/users/search',
        () =>
          HttpResponse.json(
            { error: { code: 'internal_error', message: 'boom' } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await rows()).toHaveLength(10);
  });
});
