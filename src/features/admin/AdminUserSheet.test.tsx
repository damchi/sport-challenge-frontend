import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockActivities, mockAdminChallenges, mockAdminUsers } from '../../mocks/handlers';
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

/** The activity cards of the sheet, once loaded. */
const activityCards = async () => {
  await screen.findByRole('heading', { level: 4, name: /^Semaine dernière/ });
  return part('Activités du compte').getAllByRole('article');
};

/** Opens the "…" menu of `card`. */
const openMenu = (card: HTMLElement) =>
  fireEvent.click(within(card).getByRole('button', { name: "Actions de l'activité" }));

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
  // Monday 23 November: the mock activities start last week.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-23T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

beforeEach(() => localStorage.clear());
afterEach(() => server.events.removeAllListeners());

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

  it('shows its activities by week, page by page', async () => {
    renderSheet(marie.id);

    const [first, yoga, padel] = await activityCards();
    if (!first || !yoga || !padel) throw new Error('No activities');
    expect(within(first).getByRole('heading', { level: 5 })).toHaveTextContent(/19 nov\. à 7/);
    // Pace and speed as the API gives them, none without a distance.
    expect(within(first).getByText(/8,2 km/)).toHaveTextContent('8,2 km · 5:29 /km · 10,9 km/h');
    expect(within(yoga).getByText(/pas de distance/)).not.toHaveTextContent(/\/km|km\/h/);
    expect(within(padel).getByRole('heading', { level: 5 })).toHaveTextContent(/^Padel · /);
    expect(screen.getAllByRole('heading', { level: 4 }).map((week) => week.textContent)).toEqual([
      'Semaine dernière · 16–22 nov.',
      'Semaine du 9 nov. · 9–15 nov.',
    ]);
    expect(await activityCards()).toHaveLength(10);

    fireEvent.click(part('Activités du compte').getByRole('button', { name: 'Charger plus' }));

    await screen.findByRole('heading', { level: 4, name: /^Semaine du 2 nov\./ });
    expect(await activityCards()).toHaveLength(20);

    // 50 at a time: every activity, no more button.
    const sizes = screen.getByRole('group', { name: 'Activités du compte' });
    fireEvent.click(within(sizes).getByRole('radio', { name: '50' }));
    await screen.findByRole('heading', { level: 4, name: /^Semaine du 26 oct\./ });
    expect(await activityCards()).toHaveLength(24);
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

  it('says where each activity counts, a judged week and what an admin did', async () => {
    const activity = (id: string, startedAt: string) => ({
      id,
      sport_code: 'run',
      sport_label: null,
      started_at: startedAt,
      duration_seconds: 1800,
      distance_meters: 5000,
      elevation_gain_meters: null,
      source: 'manual' as const,
      speed_mps: null,
      pace_seconds_per_km: null,
      created_at: startedAt,
      contributions: [],
      locked: false,
      admin_change: null,
    });
    const adminId = '00000000-0000-4000-8000-0000000000aa';
    server.use(
      http.get('*/api/v1/admin/users/:userId/activities', () =>
        HttpResponse.json({
          items: [
            {
              ...activity('00000000-0000-4000-8000-000000000001', '2026-11-21T14:30:00Z'),
              locked: true,
              contributions: [
                {
                  challenge_id: '00000000-0000-4000-8000-0000000000c2',
                  challenge_title: "Dénivelé d'hiver",
                  distance_meters: null,
                  duration_seconds: 1800,
                },
                {
                  challenge_id: '00000000-0000-4000-8000-0000000000c1',
                  challenge_title: "Défi d'automne",
                  distance_meters: 5000,
                  duration_seconds: 1800,
                },
              ],
            },
            {
              ...activity('00000000-0000-4000-8000-000000000002', '2026-11-20T14:30:00Z'),
              // 02:30 UTC on the 23rd: still the 22nd in Montreal.
              admin_change: { action: 'created', at: '2026-11-23T02:30:00Z', admin_id: adminId },
            },
            {
              ...activity('00000000-0000-4000-8000-000000000003', '2026-11-19T14:30:00Z'),
              admin_change: { action: 'updated', at: '2026-11-21T15:00:00Z', admin_id: adminId },
            },
            activity('00000000-0000-4000-8000-000000000004', '2026-11-18T14:30:00Z'),
          ],
          next_cursor: null,
        }),
      ),
    );
    renderSheet(marie.id);

    const [judged, added, changed, plain] = await activityCards();
    if (!judged || !added || !changed || !plain) throw new Error('No activities');
    expect(within(judged).getByText('Semaine jugée')).toBeInTheDocument();
    expect(
      within(judged).getByText("Compte pour : Dénivelé d'hiver (temps seulement), Défi d'automne"),
    ).toBeInTheDocument();
    expect(within(added).getByText("Ajoutée par l'admin le 22 nov.")).toBeInTheDocument();
    expect(within(changed).getByText("Modifiée par l'admin le 21 nov.")).toBeInTheDocument();
    expect(within(added).queryByText('Semaine jugée')).not.toBeInTheDocument();
    expect(
      within(plain).queryByText(/Compte pour|Semaine jugée|par l'admin/),
    ).not.toBeInTheDocument();
  });

  it('asks nothing for an address that is no account', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderSheet('nope');

    expect(await screen.findByText("Ce compte n'existe pas.")).toBeInTheDocument();
    expect(asked).toEqual([]);
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
    expect(await activityCards()).toHaveLength(10);
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
  it('adds an activity, or changes one, on its own page', async () => {
    renderSheet(marie.id);

    const [first] = await activityCards();
    if (!first) throw new Error('No activities');
    const activities = part('Activités du compte');
    expect(activities.getByRole('link', { name: 'Ajouter une activité' })).toHaveAttribute(
      'href',
      `/admin/users/${marie.id}/activities/new`,
    );
    expect(activities.getByText(/ne se modifie plus que par un admin/)).toBeInTheDocument();
    openMenu(first);
    expect(within(first).getByRole('link', { name: 'Modifier' })).toHaveAttribute(
      'href',
      `/admin/users/${marie.id}/activities/${mockActivities[0]?.id ?? ''}`,
    );
  });

  it('deletes an activity of any week after the preview and the reason', async () => {
    const sent: { path: string; body: unknown }[] = [];
    server.use(
      http.delete('*/api/v1/admin/activities/:activityId', async ({ request }) => {
        const body = (await request.json()) as { dry_run?: boolean };
        sent.push({ path: new URL(request.url).pathname, body });
        return HttpResponse.json({ dry_run: body.dry_run === true, challenges: [] });
      }),
    );
    renderSheet(marie.id);

    // Five days back: a locked week.
    const old = mockActivities[5];
    if (!old) throw new Error('No mock activity');
    const card = (await activityCards())[5];
    if (!card) throw new Error('No card');
    openMenu(card);
    fireEvent.click(within(card).getByRole('button', { name: 'Supprimer' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Supprimer une activité de marie_92')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    const dialog = screen.getByRole('dialog', { name: "Confirmer la suppression de l'activité" });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Motif' }), {
      target: { value: 'Doublon' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: "Supprimer l'activité" }));

    expect(
      await screen.findByText('Activité supprimée. Les défis où elle comptait sont recalculés.'),
    ).toHaveAttribute('role', 'status');
    const path = `/api/v1/admin/activities/${old.id}`;
    expect(sent).toEqual([
      { path, body: { dry_run: true } },
      { path, body: { reason: 'Doublon', dry_run: false } },
    ]);
  });

  it('offers no change to the activities of a deleted account', async () => {
    renderSheet(deleted.id);
    await screen.findByText("Ce compte n'a aucune activité.");
    expect(screen.queryByRole('link', { name: 'Ajouter une activité' })).not.toBeInTheDocument();
  });
});
