import { fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeActivity } from '../../api/hooks/useActivities';
import type { ChallengeDetail } from '../../api/hooks/useChallenges';
import type { components } from '../../api/generated/schema';
import { mockChallengeDetail, mockChallenges, mockMe } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { routes } from '../../routes/routes';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';

type ChallengeActivityPage = components['schemas']['ChallengeActivityPage'];

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;
const path = `/challenges/${id}/activities`;

// A run at 7:30 in Montréal, the time zone of the mock challenges, by Marie.
const run: ChallengeActivity = {
  id: '00000000-0000-4000-8000-0000000001a1',
  sport_code: 'run',
  sport_label: null,
  started_at: '2026-11-19T12:30:00.000Z',
  duration_seconds: 2730,
  distance_meters: 8200,
  elevation_gain_meters: null,
  source: 'manual',
  speed_mps: 3,
  pace_seconds_per_km: 333,
  contributions: [],
  locked: false,
  user: {
    id: '10000000-0000-4000-8000-000000000001',
    pseudo: 'marie_92',
    first_name: 'Marie',
    last_name: 'Tremblay',
    avatar: null,
  },
};

// Padel ("other", no distance), by a participant who abandoned and set no name.
const padel: ChallengeActivity = {
  ...run,
  id: '00000000-0000-4000-8000-0000000002a1',
  sport_code: 'other',
  sport_label: 'Padel',
  started_at: '2026-11-08T23:00:00.000Z',
  distance_meters: null,
  speed_mps: null,
  pace_seconds_per_km: null,
  locked: true,
  user: {
    id: '10000000-0000-4000-8000-000000000002',
    pseudo: null,
    first_name: null,
    last_name: null,
    avatar: null,
  },
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
function listing(...pages: ChallengeActivity[][]) {
  const requests: URL[] = [];
  server.use(
    http.get('*/api/v1/challenges/:challengeId/activities', ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const cursor = url.searchParams.get('cursor');
      const index = cursor === null ? 0 : Number(cursor) - 1;
      return HttpResponse.json<ChallengeActivityPage>({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 2) : null,
      });
    }),
  );
  return requests;
}

function refuse(status: number, code: string) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/activities', () =>
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

/** The distance of an activity as read, spaces made plain. */
const distanceOf = (activity: HTMLElement) =>
  within(activity)
    .getByText('Distance')
    .parentElement?.querySelector('dd')
    ?.textContent?.replace(/\s+/g, ' ');

const list = () => screen.findByRole('region', { name: 'Activités du défi' });

describe('ChallengeActivities', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage('fr');
  });

  it('lists every participant activity with its author, in the server order', async () => {
    answer();
    const requests = listing([run, padel]);
    renderAt(path);

    const activities = within(await list()).getAllByRole('article');
    expect(activities).toHaveLength(2);
    const first = within(activities[0] as HTMLElement);
    expect(activities[0]).toHaveAccessibleName('marie_92, Course');
    expect(first.getByText('MA')).toBeInTheDocument();
    expect(first.getByText('Manuelle')).toBeInTheDocument();
    expect(first.getByText('0:45:30')).toBeInTheDocument();
    expect(first.getByText('8,2 km')).toBeInTheDocument();
    expect(first.getByText('19 nov. 2026, 7:30')).toBeInTheDocument();
    // A participant who abandoned stays, named even without a name.
    expect(activities[1]).toHaveAccessibleName('Membre sans nom, Padel');
    expect(requests[0]?.pathname).toBe(`/api/v1/challenges/${id}/activities`);
    const nav = screen.getByRole('navigation', { name: 'Sections du défi' });
    expect(within(nav).getByRole('link', { name: 'Activités' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the elevation gain beside the distance, 0 included, nothing when not entered', async () => {
    answer();
    listing([
      { ...run, elevation_gain_meters: 450 },
      { ...run, id: '00000000-0000-4000-8000-0000000003a1', elevation_gain_meters: 0 },
      { ...run, id: '00000000-0000-4000-8000-0000000004a1' },
    ]);
    renderAt(path);

    const distances = within(await list())
      .getAllByRole('article')
      .map((activity) => distanceOf(activity));
    expect(distances).toEqual([
      '8,2 km, dénivelé positif ↗ 450 m',
      '8,2 km, dénivelé positif ↗ 0 m',
      '8,2 km',
    ]);
  });

  it('writes the elevation gain in English', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, language: 'en' })));
    answer();
    listing([{ ...run, elevation_gain_meters: 1250 }]);
    renderAt(path);

    const activity = within(await screen.findByRole('region', { name: 'Challenge activities' }))
      .getByRole('article');
    expect(distanceOf(activity)).toBe('8.2 km, elevation gain ↗ 1,250 m');
  });

  it('links nothing in the feed: neither an activity nor its author', async () => {
    answer();
    listing([run, padel]);
    renderAt(path);

    expect(within(await list()).queryAllByRole('link')).toHaveLength(0);
    expect(within(await list()).queryAllByRole('button')).toHaveLength(0);
  });

  it('opens, its tab shown, for a participant who abandoned', async () => {
    answer({ my_role: 'abandoned', my_status: 'abandoned' });
    listing([run]);
    renderAt(path);

    expect(within(await list()).getAllByRole('article')).toHaveLength(1);
    const nav = screen.getByRole('navigation', { name: 'Sections du défi' });
    expect(within(nav).getByRole('link', { name: 'Activités' })).toBeInTheDocument();
  });

  it('loads the next page of activities', async () => {
    answer({ my_role: 'creator' });
    const requests = listing([run], [padel]);
    renderAt(path);

    await list();
    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));

    expect(await screen.findByRole('heading', { name: 'Padel' })).toBeInTheDocument();
    expect(within(await list()).getAllByRole('article')).toHaveLength(2);
    expect(requests[1]?.searchParams.get('cursor')).toBe('2');
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
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

  it.each(['not_found', 'challenge_not_found'])(
    'says the same, never the server text, for a 404 %s',
    async (code) => {
      answer();
      refuse(404, code);
      renderAt(path);

      expect(await screen.findByText('Ces activités ne sont pas disponibles.')).toBeInTheDocument();
      expect(screen.queryByText('Server text')).not.toBeInTheDocument();
    },
  );

  it.each(['outsider', 'invited'] as const)(
    'hides the tab from an %s, and asks the API nothing at its address',
    async (role) => {
      answer({ my_role: role, my_status: null });
      const requests = listing([run]);
      renderAt(path);

      expect(await screen.findByText('Ces activités ne sont pas disponibles.')).toBeInTheDocument();
      const nav = screen.getByRole('navigation', { name: 'Sections du défi' });
      expect(within(nav).getAllByRole('link')).toHaveLength(2);
      expect(within(nav).queryByRole('link', { name: 'Activités' })).not.toBeInTheDocument();
      expect(requests).toHaveLength(0);
    },
  );

  it('says when no one has an activity yet', async () => {
    answer();
    listing([]);
    renderAt(path);

    expect(
      await screen.findByText("Aucune activité dans ce défi pour l'instant."),
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
