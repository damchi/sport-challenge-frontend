import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockAdminChallenges, mockAdminUsers } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminUserSheet } from './AdminUserSheet';

const [marie, , deleted] = mockAdminUsers;
const other = mockAdminUsers[5];
if (!marie || !deleted || !other) throw new Error('No mock accounts');

function renderSheet(userId: string) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [{ path: '/admin/users/:userId', element: <AdminUserSheet /> }],
    { initialEntries: [`/admin/users/${userId}`] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

/** A part of the sheet, found by its heading. */
function part(name: string) {
  const section = screen.getByRole('heading', { level: 3, name }).closest('section');
  if (!section) throw new Error(`No part ${name}`);
  return within(section);
}

const rowsOf = async (name: string) => {
  const table = await screen.findByRole('table', { name });
  return within(table).getAllByRole('row').slice(1);
};

/** The value of a fact of the profile. */
const fact = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling;

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

describe('AdminUserSheet', () => {
  it('shows the profile with the e-mail', async () => {
    renderSheet(marie.id);

    expect(await screen.findByRole('heading', { level: 2, name: 'marie_92' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tous les comptes' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
    expect(fact('État')).toHaveTextContent('Actif');
    expect(fact('Prénom')).toHaveTextContent('Marie');
    expect(fact('Nom')).toHaveTextContent('Tremblay');
    expect(fact('E-mail')).toHaveTextContent('marie@example.com');
    expect(fact('Inscrit le')).toHaveTextContent('20 nov. 2026, 09:00');
    expect(fact('Dernière activité')).toHaveTextContent('19 nov. 2026, 07:30');
    expect(screen.queryByText('Supprimé le')).not.toBeInTheDocument();
  });

  it('lists its challenges with its role, each linked to its admin sheet', async () => {
    renderSheet(marie.id);

    const [first, second] = await rowsOf('Défis du compte');
    if (!first || !second) throw new Error('No challenges');
    expect(within(first).getByRole('link', { name: 'Défi 1' })).toHaveAttribute(
      'href',
      `/admin/challenges/${mockAdminChallenges[0]?.id ?? ''}`,
    );
    expect(within(first).getByText('Créateur')).toBeInTheDocument();
    expect(within(first).getByText('À venir')).toBeInTheDocument();
    expect(within(first).getByText('22 oct. 2026, 10:00')).toBeInTheDocument();
    expect(within(second).getByText('Abandonné ou exclu')).toBeInTheDocument();
    expect(within(second).getByText('Depuis le 10 nov. 2026, 09:00')).toBeInTheDocument();
    // Ten at a time.
    expect(await rowsOf('Défis du compte')).toHaveLength(10);
  });

  it('shows its activities page by page', async () => {
    renderSheet(marie.id);

    const [first] = await rowsOf('Activités du compte');
    if (!first) throw new Error('No activities');
    expect(within(first).getByText('19 nov. 2026, 07:30')).toBeInTheDocument();
    expect(await rowsOf('Activités du compte')).toHaveLength(10);

    fireEvent.click(part('Activités du compte').getByRole('button', { name: 'Charger plus' }));

    await screen.findByText('10 nov. 2026, 07:30');
    expect(await rowsOf('Activités du compte')).toHaveLength(20);

    // 50 at a time: every activity, no more button.
    const sizes = screen.getByRole('group', { name: 'Activités du compte' });
    fireEvent.click(within(sizes).getByRole('radio', { name: '50' }));
    await screen.findByText('27 oct. 2026, 08:30');
    expect(await rowsOf('Activités du compte')).toHaveLength(24);
    expect(
      part('Activités du compte').queryByRole('button', { name: 'Charger plus' }),
    ).not.toBeInTheDocument();
  });

  it('says when the account has no challenge and no activity', async () => {
    renderSheet(other.id);

    expect(await screen.findByText("Ce compte n'est dans aucun défi.")).toBeInTheDocument();
    expect(await screen.findByText("Ce compte n'a aucune activité.")).toBeInTheDocument();
  });

  it('shows a deleted account without its data', async () => {
    renderSheet(deleted.id);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Compte supprimé' }),
    ).toBeInTheDocument();
    expect(fact('État')).toHaveTextContent('Supprimé');
    expect(fact('E-mail')).toHaveTextContent('Non renseigné');
    expect(fact('Supprimé le')).toHaveTextContent('21 nov. 2026, 05:00');
  });

  it('says when the account does not exist', async () => {
    renderSheet('40000000-0000-4000-8000-999999999999');

    expect(await screen.findByText("Ce compte n'existe pas.")).toBeInTheDocument();
  });

  it('asks nothing for an address that is no account', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderSheet('nope');

    expect(await screen.findByText("Ce compte n'existe pas.")).toBeInTheDocument();
    expect(asked).toEqual([]);
    server.events.removeAllListeners();
  });

  it('shows the error of a part and reloads it on retry', async () => {
    server.use(
      http.get(
        '*/api/v1/admin/users/:userId/activities',
        () =>
          HttpResponse.json(
            { error: { code: 'internal_error', message: 'boom' } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    renderSheet(marie.id);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    // The rest of the sheet is there.
    expect(await rowsOf('Défis du compte')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await rowsOf('Activités du compte')).toHaveLength(10);
  });

  it('shows the error of the account and reloads on retry', async () => {
    server.use(
      http.get(
        '*/api/v1/admin/users/:userId',
        () =>
          HttpResponse.json(
            { error: { code: 'internal_error', message: 'boom' } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    renderSheet(marie.id);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'marie_92' })).toBeInTheDocument();
  });
});
