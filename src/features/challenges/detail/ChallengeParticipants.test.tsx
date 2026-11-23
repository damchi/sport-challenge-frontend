import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail, Participant } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges, mockParticipants } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { routes } from '../../../routes/routes';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;
const path = `/challenges/${id}/participants`;

// A challenge of Montréal joined by the user.
function answer(detail: Partial<ChallengeDetail> = {}) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () =>
      HttpResponse.json<ChallengeDetail>({
        ...mockChallengeDetail(summary),
        my_role: 'participant',
        my_status: 'active',
        ...detail,
      }),
    ),
  );
}

function participant(overrides: Partial<Participant>): Participant {
  return {
    user_id: '10000000-0000-4000-8000-000000000001',
    pseudo: 'sam',
    first_name: 'Sam',
    last_name: 'Roy',
    avatar: null,
    status: 'active',
    is_creator: false,
    joined_at: '2026-11-02T15:00:00Z',
    ...overrides,
  };
}

function listing(items: Participant[]) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/participants', () =>
      HttpResponse.json({ items, next_cursor: null }),
    ),
  );
}

function renderAt(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

// The region, once its list is loaded (the size choice shows before it).
const list = async () => {
  const region = await screen.findByRole('region', { name: 'Participants du défi' });
  await within(region).findByRole('list');
  return region;
};

describe('ChallengeParticipants', () => {
  it('shows each participant with their status and day of registration', async () => {
    answer();
    listing([
      participant({}),
      participant({
        user_id: '10000000-0000-4000-8000-000000000002',
        pseudo: 'jean.luc',
        status: 'abandoned',
        // Still 1 November in Montréal.
        joined_at: '2026-11-02T03:00:00Z',
      }),
    ]);
    renderAt(path);

    const rows = within(await list()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const [active, abandoned] = rows as [HTMLElement, HTMLElement];
    expect(within(active).getByText('sam')).toBeInTheDocument();
    expect(within(active).getByText('Actif')).toBeInTheDocument();
    expect(within(active).getByText('Inscription : 2 nov.')).toBeInTheDocument();
    expect(within(abandoned).getByText('jean.luc')).toBeInTheDocument();
    expect(within(abandoned).getByText('A abandonné')).toBeInTheDocument();
    expect(within(abandoned).getByText('Inscription : 1 nov.')).toBeInTheDocument();
  });

  it('names a participant without any name with a neutral name', async () => {
    answer();
    listing([
      participant({ pseudo: null }),
      participant({
        user_id: '10000000-0000-4000-8000-000000000002',
        pseudo: null,
        first_name: null,
        last_name: null,
      }),
    ]);
    renderAt(path);

    const region = await list();
    expect(within(region).getByText('Sam Roy')).toBeInTheDocument();
    expect(within(region).getByText('Membre sans nom')).toBeInTheDocument();
  });

  it('loads the next page of participants', async () => {
    answer();
    renderAt(path);

    // 10 by default, then 10 more, then the last 5.
    const region = await list();
    expect(within(region).getAllByRole('listitem')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(await within(region).findByText(mockParticipants[19]?.pseudo ?? '')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(await within(region).findByText(mockParticipants[24]?.pseudo ?? '')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(mockParticipants.length);
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  describe('size of the list', () => {
    // Records the limit and the cursor of each request, the participants
    // being served from the mock list.
    function recordQueries() {
      const queries: URLSearchParams[] = [];
      server.events.on('request:start', ({ request }) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/participants')) queries.push(url.searchParams);
      });
      return queries;
    }
    afterEach(() => server.events.removeAllListeners());

    it('asks for 10 by default, then 50 once chosen, from the start, and keeps it', async () => {
      answer();
      const queries = recordQueries();
      renderAt(path);

      const region = await list();
      expect(queries.at(-1)?.get('limit')).toBe('10');
      fireEvent.click(within(region).getByRole('radio', { name: '50' }));

      await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(25));
      expect(queries.at(-1)?.get('limit')).toBe('50');
      expect(queries.at(-1)?.has('cursor')).toBe(false);
      expect(within(region).getByRole('radio', { name: '50' })).toBeChecked();
      expect(localStorage.getItem('sport-challenge:page-size:participants')).toBe('50');
    });

    it('reads the size kept on the device', async () => {
      localStorage.setItem('sport-challenge:page-size:participants', '50');
      answer();
      renderAt(path);

      const region = await list();
      expect(within(region).getAllByRole('listitem')).toHaveLength(25);
      expect(within(region).getByRole('radio', { name: '50' })).toBeChecked();
    });

    it('still lets the size be chosen when the storage is unavailable', async () => {
      const broken = () => {
        throw new Error('Storage disabled');
      };
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(broken);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(broken);
      answer();
      renderAt(path);

      try {
        const region = await list();
        expect(within(region).getByRole('radio', { name: '10' })).toBeChecked();
        fireEvent.click(within(region).getByRole('radio', { name: '50' }));
        await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(25));
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('reads every page in turn, by 100, when « Tout » is chosen', async () => {
      answer();
      const queries: URLSearchParams[] = [];
      server.use(
        http.get('*/api/v1/challenges/:challengeId/participants', ({ request }) => {
          const query = new URL(request.url).searchParams;
          queries.push(query);
          const cursor = query.get('cursor');
          return HttpResponse.json({
            items: [
              participant({ user_id: `id-${cursor ?? 'first'}`, pseudo: `p-${cursor ?? '0'}` }),
            ],
            next_cursor: cursor === null ? 'c1' : cursor === 'c1' ? 'c2' : null,
          });
        }),
      );
      renderAt(path);

      const region = await list();
      fireEvent.click(within(region).getByRole('radio', { name: 'Tout' }));

      expect(await within(region).findByText('p-c2')).toBeInTheDocument();
      expect(within(region).getAllByRole('listitem')).toHaveLength(3);
      expect(queries.at(-1)?.get('limit')).toBe('100');
      expect(queries.map((query) => query.get('cursor'))).toEqual([null, null, 'c1', 'c2']);
      expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
    });

    it('keeps the pages read when one fails in the middle of « Tout », and retries', async () => {
      answer();
      let failures = 0;
      server.use(
        http.get('*/api/v1/challenges/:challengeId/participants', ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
          if (cursor === 'c1' && failures++ === 0) return new HttpResponse(null, { status: 503 });
          return HttpResponse.json({
            items: [
              participant({ user_id: `id-${cursor ?? 'first'}`, pseudo: `p-${cursor ?? '0'}` }),
            ],
            next_cursor: cursor === null ? 'c1' : null,
          });
        }),
      );
      renderAt(path);

      const region = await list();
      fireEvent.click(within(region).getByRole('radio', { name: 'Tout' }));

      expect(await within(region).findByRole('alert')).toHaveTextContent(
        "La suite n'a pas pu être chargée.",
      );
      expect(within(region).getByText('p-0')).toBeInTheDocument();
      fireEvent.click(within(region).getByRole('button', { name: 'Réessayer' }));

      expect(await within(region).findByText('p-c1')).toBeInTheDocument();
      expect(within(region).queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('opens the activities of a participant for a participant of the challenge', async () => {
    answer();
    listing([participant({})]);
    const router = renderAt(path);

    fireEvent.click(await screen.findByRole('link', { name: /sam/ }));
    // Once the code of the participant's page has loaded.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/challenges/${id}/participants/10000000-0000-4000-8000-000000000001`,
      ),
    );
    expect(screen.getByRole('link', { name: 'Participants' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not link to the activities for a visitor of a public challenge', async () => {
    answer({ my_role: 'outsider', my_status: null });
    listing([participant({})]);
    renderAt(path);

    expect(within(await list()).getByText('sam')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sam/ })).not.toBeInTheDocument();
  });

  it('says when no one has joined yet', async () => {
    answer();
    listing([]);
    renderAt(path);

    expect(await screen.findByText("Personne n'a encore rejoint ce défi.")).toBeInTheDocument();
  });

  it('offers a retry when the participants cannot load', async () => {
    answer();
    server.use(
      http.get('*/api/v1/challenges/:challengeId/participants', () =>
        HttpResponse.json({ error: { code: 'internal_error', message: 'Boom' } }, { status: 500 }),
      ),
    );
    renderAt(path);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Nothing to size while the list failed.
    expect(screen.queryByRole('group', { name: 'Afficher' })).not.toBeInTheDocument();
    listing([participant({})]);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(within(await list()).getByText('sam')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Afficher' })).toBeInTheDocument();
  });
});
