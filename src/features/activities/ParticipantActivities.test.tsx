import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Activity } from '../../api/hooks/useActivities';
import type { ChallengeDetail } from '../../api/hooks/useChallenges';
import type { components } from '../../api/generated/schema';
import { mockChallengeDetail, mockChallenges, mockMe } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { routes } from '../../routes/routes';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';

type ActivityPage = components['schemas']['ActivityPage'];

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;
const USER_ID = '10000000-0000-4000-8000-000000000001';
const path = `/challenges/${id}/participants/${USER_ID}`;

// A run at 7:30 in Montréal, the time zone of the mock challenges.
const run: Activity = {
  id: '00000000-0000-4000-8000-0000000001a1',
  sport_code: 'run',
  sport_label: null,
  started_at: '2026-11-19T12:30:00.000Z',
  duration_seconds: 2730,
  distance_meters: 8200,
  source: 'manual',
  speed_mps: 3,
  pace_seconds_per_km: 333,
  contributions: [],
  locked: false,
};

// Padel ("other", no distance), of a week that has ended.
const padel: Activity = {
  ...run,
  id: '00000000-0000-4000-8000-0000000002a1',
  sport_code: 'other',
  sport_label: 'Padel',
  started_at: '2026-11-08T23:00:00.000Z',
  distance_meters: null,
  speed_mps: null,
  pace_seconds_per_km: null,
  locked: true,
};

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

/** The list answers these pages, one per cursor (none, then "2"...). */
function listing(...pages: Activity[][]) {
  const requests: URL[] = [];
  server.use(
    http.get('*/api/v1/challenges/:challengeId/participants/:userId/activities', ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const cursor = url.searchParams.get('cursor');
      const index = cursor === null ? 0 : Number(cursor) - 1;
      return HttpResponse.json<ActivityPage>({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 2) : null,
      });
    }),
  );
  return requests;
}

function refuse(status: number, code: string) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/participants/:userId/activities', () =>
      HttpResponse.json({ error: { code, message: 'Server text' } }, { status }),
    ),
  );
}

function deviceIn(timeZone: string) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone };
  });
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

const list = () => screen.findByRole('region', { name: 'Activités du participant' });

describe('ParticipantActivities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is titled with the name of the participant, with a way back to the participants', async () => {
    answer();
    listing([run]);
    const router = renderAt(path);

    // The name comes from the leaderboard: the activities route gives none.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Activités de jean.luc1' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Voir les participants' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(`/challenges/${id}/participants`),
    );
  });

  it('says "Tes activités" for the user', async () => {
    answer();
    listing([run]);
    renderAt(`/challenges/${id}/participants/${mockMe.id}`);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Tes activités' }),
    ).toBeInTheDocument();
  });

  it('keeps a neutral title while the name is not known', async () => {
    answer();
    listing([run]);
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', () =>
        HttpResponse.json({ computed_at: '2026-11-18T15:00:00Z', categories: [] }),
      ),
    );
    renderAt(path);

    await list();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Activités du participant' }),
    ).toBeInTheDocument();
  });

  it('does not name the time zone when the device shares it', async () => {
    deviceIn(summary.timezone);
    answer();
    listing([run]);
    renderAt(path);

    await list();
    expect(screen.queryByText(/Heures affichées/)).not.toBeInTheDocument();
  });

  it('names the challenge time zone when the device is in another one', async () => {
    deviceIn('Europe/Paris');
    answer();
    listing([run]);
    renderAt(path);

    expect(within(await list()).getByText(/^Heures affichées : /)).toBeInTheDocument();
    expect(screen.getByText('19 nov. 2026, 7:30')).toBeInTheDocument();
  });

  it('lists the activities of the participant, read only, marked "manual"', async () => {
    answer();
    const requests = listing([run, padel]);
    renderAt(path);

    const activities = within(await list()).getAllByRole('article');
    expect(activities).toHaveLength(2);
    const first = within(activities[0] as HTMLElement);
    expect(first.getByRole('heading', { name: 'Course' })).toBeInTheDocument();
    expect(first.getByText('Manuelle')).toBeInTheDocument();
    expect(first.getByText('0:45:30')).toBeInTheDocument();
    expect(first.getByText('8,2 km')).toBeInTheDocument();
    expect(first.getByText('19 nov. 2026, 7:30')).toBeInTheDocument();
    expect(within(activities[1] as HTMLElement).getByText('Padel')).toBeInTheDocument();
    // Nothing to change, even an activity of a week still open.
    expect(screen.queryByRole('link', { name: 'Modifier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
    expect(requests[0]?.pathname).toBe(
      `/api/v1/challenges/${id}/participants/${USER_ID}/activities`,
    );
    expect(screen.getByRole('link', { name: 'Participants' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens for a creator too', async () => {
    answer({ my_role: 'creator' });
    listing([run]);
    renderAt(path);

    expect(within(await list()).getAllByRole('article')).toHaveLength(1);
  });

  it('loads the next page of activities', async () => {
    answer();
    const requests = listing([run], [padel]);
    renderAt(path);

    await list();
    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));

    expect(await screen.findByRole('heading', { name: 'Padel' })).toBeInTheDocument();
    expect(within(await list()).getAllByRole('article')).toHaveLength(2);
    expect(requests[1]?.searchParams.get('cursor')).toBe('2');
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  it.each([
    ['a participant the user never saw join', 'not_found', {}],
    ['a challenge the user may not see', 'challenge_not_found', {}],
  ])('says the same, never the server text, for %s', async (_case, code, detail) => {
    answer(detail);
    refuse(404, code);
    renderAt(path);

    expect(await screen.findByText('Ces activités ne sont pas disponibles.')).toBeInTheDocument();
    expect(screen.queryByText('Server text')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir les participants' })).toHaveAttribute(
      'href',
      `/challenges/${id}/participants`,
    );
  });

  it.each(['outsider', 'invited'] as const)(
    'says the same to an %s, without asking the API',
    async (role) => {
      answer({ my_role: role, my_status: null });
      const requests = listing([run]);
      renderAt(path);

      expect(await screen.findByText('Ces activités ne sont pas disponibles.')).toBeInTheDocument();
      expect(requests).toHaveLength(0);
    },
  );

  it('does not ask the API for an id that cannot be one', async () => {
    answer();
    const requests = listing([run]);
    renderAt(`/challenges/${id}/participants/not-a-user`);

    expect(await screen.findByText('Ces activités ne sont pas disponibles.')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('says when the participant has no activity yet', async () => {
    answer();
    listing([]);
    renderAt(path);

    expect(
      await screen.findByText("Ce participant n'a pas encore d'activité dans ce défi."),
    ).toBeInTheDocument();
  });

  it('offers a retry when the activities cannot load', async () => {
    answer();
    refuse(500, 'internal');
    renderAt(path);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    listing([run]);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(within(await list()).getAllByRole('article')).toHaveLength(1);
  });
});
