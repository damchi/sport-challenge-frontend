import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockAdminChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminChallengeList } from './AdminChallengeList';

function renderList(path = '/admin/challenges') {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [
      { path: '/admin/challenges', element: <AdminChallengeList /> },
      { path: '/admin/challenges/:challengeId', element: <p>Sheet</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** The queries the list sent, in order. */
function recordQueries() {
  const queries: URLSearchParams[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/admin/challenges') queries.push(url.searchParams);
  });
  return queries;
}

const rows = async () => {
  const table = await screen.findByRole('table', { name: 'Tous les défis' });
  // The header row left out.
  return within(table).getAllByRole('row').slice(1);
};

beforeEach(() => localStorage.clear());
afterEach(() => server.events.removeAllListeners());

describe('AdminChallengeList', () => {
  it('lists the challenges in a table, each linked to its sheet', async () => {
    renderList();

    const [first] = await rows();
    if (!first) throw new Error('No row');
    const cells = within(first);
    expect(cells.getByRole('link', { name: 'Défi 1' })).toHaveAttribute(
      'href',
      `/admin/challenges/${mockAdminChallenges[0]?.id ?? ''}`,
    );
    expect(cells.getByText('ami_1, ami_2')).toBeInTheDocument();
    expect(cells.getByText('2 nov. 2026 – 29 nov. 2026')).toBeInTheDocument();
    expect(cells.getByText('À venir')).toBeInTheDocument();
  });

  it('marks the private and the deleted challenges', async () => {
    renderList('/admin/challenges?deleted=true');

    const [deleted] = await rows();
    if (!deleted) throw new Error('No row');
    expect(within(deleted).getByText('Privé · Supprimé')).toBeInTheDocument();
  });

  it('sends the search and every filter, kept in the address', async () => {
    const queries = recordQueries();
    const router = renderList();
    await rows();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un défi par son titre' }), {
      target: { value: '  Défi 1 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Statut' })).getByRole('button', {
        name: 'En cours',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Visibilité' })).getByRole('button', {
        name: 'Privés',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Supprimés' }));

    expect(screen.getByRole('button', { name: 'Supprimés' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await screen.findByText('Aucun défi ne correspond à ces filtres.');
    const last = queries.at(-1);
    expect(Object.fromEntries(last ?? [])).toEqual({
      q: 'Défi 1',
      status: 'ongoing',
      visibility: 'private',
      deleted: 'true',
      limit: '10',
    });
    expect(router.state.location.search).toBe(
      '?q=D%C3%A9fi+1&status=ongoing&visibility=private&deleted=true',
    );

    // Back to every challenge.
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(await rows()).toHaveLength(10);
    expect(Object.fromEntries(queries.at(-1) ?? [])).toEqual({ limit: '10' });
  });

  it('reads the next page on "load more", with the cursor', async () => {
    const queries = recordQueries();
    renderList();
    expect(await rows()).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));

    await screen.findByRole('link', { name: 'Défi 20' });
    expect(await rows()).toHaveLength(20);
    expect(queries.at(-1)?.get('cursor')).toBe('10');
  });

  it('shows 50 at a time once chosen', async () => {
    renderList();
    await rows();

    fireEvent.click(screen.getByRole('radio', { name: '50' }));

    await screen.findByRole('link', { name: 'Défi 24' });
    expect(await rows()).toHaveLength(24);
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  it('says when there is no challenge at all', async () => {
    server.use(
      http.get('*/api/v1/admin/challenges', () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    );
    renderList();

    expect(await screen.findByText("Aucun défi pour l'instant.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Effacer les filtres' })).not.toBeInTheDocument();
  });

  it('shows the error and reloads on retry', async () => {
    server.use(
      http.get(
        '*/api/v1/admin/challenges',
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
