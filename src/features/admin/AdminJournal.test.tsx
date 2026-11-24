import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockActivities, mockAdminActions, mockAdminChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminJournal } from './AdminJournal';

function renderJournal(path = '/admin/journal') {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [
      { path: '/admin/journal', element: <AdminJournal /> },
      { path: '/admin/challenges/:challengeId', element: <p>Challenge sheet</p> },
      { path: '/admin/users/:userId', element: <p>Account sheet</p> },
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

/** The queries the journal sent, in order. */
function recordQueries() {
  const queries: URLSearchParams[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/admin/actions') queries.push(url.searchParams);
  });
  return queries;
}

const rows = async () => {
  const table = await screen.findByRole('table', { name: 'Journal des actions admin' });
  // The header row left out.
  return within(table).getAllByRole('row').slice(1);
};

const row = async (index: number) => {
  const found = (await rows())[index];
  if (!found) throw new Error(`No row ${index}`);
  return within(found);
};

const CHALLENGE = mockAdminChallenges[0]?.id ?? '';

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

describe('AdminJournal', () => {
  it('lists the changes: when, who, what, on which target and why', async () => {
    renderJournal();

    const first = await row(0);
    expect(first.getByRole('rowheader')).toHaveTextContent('20 nov. 2026, 11:00');
    expect(first.getByText('ami_9')).toBeInTheDocument();
    expect(first.getByText('Réglages modifiés')).toBeInTheDocument();
    expect(first.getByText('Défi')).toBeInTheDocument();
    expect(first.getByRole('link', { name: 'Fiche du défi' })).toHaveAttribute(
      'href',
      `/admin/challenges/${CHALLENGE}`,
    );
    expect(first.getByText('Correction 1')).toBeInTheDocument();

    // A participant opens its account; an activity has no sheet.
    expect((await row(1)).getByRole('link', { name: 'Fiche du compte' })).toBeInTheDocument();
    const activity = await row(2);
    expect(activity.getByText('Activité supprimée')).toBeInTheDocument();
    expect(activity.queryByRole('link', { name: /^Fiche/ })).not.toBeInTheDocument();
    // A change the app has no label for yet: its code.
    expect((await row(3)).getByText('user.update')).toBeInTheDocument();
  });

  it('shows the old and new values on demand', async () => {
    renderJournal();

    const first = await row(0);
    const values = first.getByText('Voir les valeurs');
    const details = values.closest('details');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(values);
    expect(details).toHaveAttribute('open');

    const title = first.getByText('title').closest('div');
    expect(title).toHaveTextContent('Avant : Avant');
    expect(title).toHaveTextContent('Après : Après');
    const deadline = first.getByText('registration_deadline').closest('div');
    expect(deadline).toHaveTextContent('Avant : null');
    expect(deadline).toHaveTextContent('Après : 2026-11-30T05:00:00Z');

    // A removal: the old values only.
    const removed = (await row(2)).getByText('sport_code').closest('div');
    expect(removed).toHaveTextContent('Avant : run');
    expect(removed).toHaveTextContent('Après : aucune');
  });

  it('keeps one kind of target, in the address', async () => {
    const queries = recordQueries();
    const router = renderJournal();
    await rows();

    fireEvent.click(screen.getByRole('button', { name: 'Activité' }));

    await screen.findByRole('button', { name: 'Activité', pressed: true });
    expect(await rows()).toHaveLength(6);
    expect(router.state.location.search).toBe('?target_type=activity');
    expect(Object.fromEntries(queries.at(-1) ?? [])).toEqual({
      target_type: 'activity',
      limit: '10',
    });
  });

  it('opens the journal of one target from its row', async () => {
    const queries = recordQueries();
    const router = renderJournal();

    fireEvent.click((await row(2)).getByRole('link', { name: 'Actions sur cette cible' }));

    expect(
      await screen.findByText('Seules les actions sur une cible sont affichées.'),
    ).toBeInTheDocument();
    expect(Object.fromEntries(queries.at(-1) ?? [])).toEqual({
      target_type: 'activity',
      target_id: mockActivities[0]?.id,
      limit: '10',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Afficher toutes les cibles' }));

    await screen.findByRole('button', { name: 'Activité', pressed: true });
    expect(router.state.location.search).toBe('?target_type=activity');
    expect(
      screen.queryByText('Seules les actions sur une cible sont affichées.'),
    ).not.toBeInTheDocument();
  });

  it('keeps the changes that touch a challenge, from its sheet', async () => {
    const queries = recordQueries();
    renderJournal(`/admin/journal?challenge_id=${CHALLENGE}`);

    expect(
      await screen.findByText('Seules les actions qui touchent un défi sont affichées.'),
    ).toBeInTheDocument();
    await rows();
    expect(queries.at(-1)?.get('challenge_id')).toBe(CHALLENGE);
  });

  it('reads the next page on "load more", with the cursor', async () => {
    const queries = recordQueries();
    renderJournal();
    expect(await rows()).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));

    await screen.findByText('Correction 20');
    expect(await rows()).toHaveLength(20);
    expect(queries.at(-1)?.get('cursor')).toBe('10');
  });

  it('shows 50 at a time once chosen', async () => {
    renderJournal();
    await rows();

    fireEvent.click(screen.getByRole('radio', { name: '50' }));

    await screen.findByText(`Correction ${mockAdminActions.length}`);
    expect(await rows()).toHaveLength(mockAdminActions.length);
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  it('says when no change matches, and clears the filters', async () => {
    server.use(
      http.get('*/api/v1/admin/actions', ({ request }) =>
        HttpResponse.json({
          items: new URL(request.url).searchParams.has('target_type') ? [] : mockAdminActions,
          next_cursor: null,
        }),
      ),
    );
    renderJournal('/admin/journal?target_type=user');

    expect(
      await screen.findByText('Aucune action ne correspond à ces filtres.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(await screen.findByRole('button', { name: 'Toutes', pressed: true })).toBeVisible();
    await rows();
  });

  it('says when there is no change at all', async () => {
    server.use(
      http.get('*/api/v1/admin/actions', () => HttpResponse.json({ items: [], next_cursor: null })),
    );
    renderJournal();

    expect(await screen.findByText("Aucune action admin pour l'instant.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Effacer les filtres' })).not.toBeInTheDocument();
  });

  it('shows the error and reloads on retry', async () => {
    server.use(
      http.get(
        '*/api/v1/admin/actions',
        () =>
          HttpResponse.json(
            { error: { code: 'internal_error', message: 'boom' } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    renderJournal();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await rows()).toHaveLength(10);
  });
});
