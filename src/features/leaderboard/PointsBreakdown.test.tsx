import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type {
  ChallengeDetail,
  Leaderboard,
  LeaderboardEntry,
  PointsBreakdown,
  PointsWeek,
} from '../../api/hooks/useChallenges';
import type { components } from '../../api/generated/schema';
import { timeZoneName } from '../../domain/format/challengeDates';
import { mockChallengeDetail, mockChallenges, mockMe } from '../../mocks/handlers';
import { answerLeaderboard, type FullRanking } from '../../mocks/leaderboard';
import { server } from '../../mocks/server';
import { routes } from '../../routes/routes';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';

type ApiErrorBody = components['schemas']['Error'];

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;
const JULIE = '10000000-0000-4000-8000-000000000001';

const pointsDetail = {
  categories: [
    {
      type: 'points',
      position: 4,
      params: { criteria: ['longest_duration', 'session_count'], podium: 5 },
    },
  ],
} satisfies Partial<ChallengeDetail>;

function answer(detail: Partial<ChallengeDetail> = {}) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () =>
      HttpResponse.json<ChallengeDetail>({
        ...mockChallengeDetail(summary),
        my_role: 'participant',
        my_status: 'active',
        ...pointsDetail,
        ...detail,
      }),
    ),
  );
}

function entry(
  pseudo: string,
  userId: string,
  rank: number | null,
  points: number | null,
  provisional: number | null = null,
): LeaderboardEntry {
  return {
    rank,
    user: { id: userId, pseudo, first_name: 'Alex', last_name: 'Gagnon', avatar: null },
    value: points,
    abandoned: rank === null,
    elimination: null,
    provisional_points: provisional,
  };
}

const ranking: FullRanking[] = [
  {
    type: 'points',
    ranked_count: 0,
    entries: [
      entry('julie', JULIE, 1, 18, 8),
      entry('marc', '10000000-0000-4000-8000-000000000004', 2, 16),
      entry('sofia', '10000000-0000-4000-8000-000000000005', 3, 12),
      entry('marie_92', mockMe.id, 4, 10),
      entry('leo', '10000000-0000-4000-8000-000000000003', null, null),
    ],
  },
];

function leaderboard() {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) =>
      HttpResponse.json<Leaderboard>(
        answerLeaderboard(
          '2026-11-18T15:00:00Z',
          ranking,
          new URL(request.url).searchParams,
          mockMe.id,
        ),
      ),
    ),
  );
}

/** Week 1 (2 nov.) locked, week 2 not yet; julie is tied first on the duration of week 1. */
const week1: PointsWeek = {
  number: 1,
  starts_at: '2026-11-02T05:00:00Z',
  ends_at: '2026-11-09T05:00:00Z',
  locked: true,
  points: 18,
  criteria: [
    { criterion: 'longest_duration', rank: 1, value: 5_400, points: 10 },
    { criterion: 'session_count', rank: 2, value: 4, points: 8 },
  ],
};
const week2: PointsWeek = {
  number: 2,
  starts_at: '2026-11-09T05:00:00Z',
  ends_at: '2026-11-16T05:00:00Z',
  locked: false,
  points: 8,
  criteria: [
    { criterion: 'longest_duration', rank: 2, value: 3_600, points: 8 },
    { criterion: 'session_count', rank: null, value: 0, points: 0 },
  ],
};

function breakdown(body: Partial<PointsBreakdown> = {}) {
  const asked: string[] = [];
  server.use(
    http.get('*/api/v1/challenges/:challengeId/participants/:userId/points', ({ params }) => {
      asked.push(String(params.userId));
      return HttpResponse.json<PointsBreakdown>({
        user_id: String(params.userId),
        computed_at: '2026-11-18T15:00:00Z',
        abandoned: false,
        frozen: false,
        acquired_points: 18,
        provisional_points: 8,
        weeks: [week1, week2],
        ...body,
      });
    }),
  );
  return asked;
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

function deviceIn(timeZone: string) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone };
  });
}

async function open(name: RegExp) {
  const podium = await screen.findByRole('region', { name: 'Podium' });
  fireEvent.click(within(podium).getByRole('button', { name }));
  return screen.findByRole('dialog');
}

describe('PointsBreakdownSheet', () => {
  beforeEach(() => {
    deviceIn(summary.timezone);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens from a podium card with the weeks, provisional ones apart from the acquired', async () => {
    answer();
    leaderboard();
    const asked = breakdown();
    renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    expect(sheet).toHaveAccessibleName('Points de julie');
    expect(await within(sheet).findByText('18 pts acquis')).toBeInTheDocument();
    expect(within(sheet).getByText('+ 8 pts provisoires')).toBeInTheDocument();
    expect(asked).toEqual([JULIE]);

    const provisional = within(sheet).getByRole('region', { name: 'Semaines provisoires' });
    const second = within(provisional).getByRole('region', { name: 'Semaine 2' });
    expect(second).toHaveTextContent('9 nov. – 15 nov.');
    expect(second).toHaveTextContent('8 pts provisoires');
    expect(second).toHaveTextContent('Séance la plus longue en temps1:00 · 2e de la semaine8 pts');
    // A value of 0 does not score: no rank, no points, said plainly.
    expect(second).toHaveTextContent('Nombre de séances0 séance · Non classé0 pt');

    const acquired = within(sheet).getByRole('region', { name: 'Semaines acquises' });
    const first = within(acquired).getByRole('region', { name: 'Semaine 1' });
    expect(first).toHaveTextContent('2 nov. – 8 nov.');
    expect(first).toHaveTextContent('18 pts');
    // The rank of a tie, as the server gives it.
    expect(first).toHaveTextContent('1:30 · 1er de la semaine10 pts');
    expect(first).toHaveTextContent('4 séances · 2e de la semaine8 pts');
    expect(within(acquired).queryByRole('region', { name: 'Semaine 2' })).not.toBeInTheDocument();
  });

  it('opens from a row of the ranking, mine named « Tes points », and closes', async () => {
    answer();
    leaderboard();
    const asked = breakdown({ provisional_points: null, weeks: [week1] });
    renderAt(`/challenges/${id}?category=points`);

    const rest = await screen.findByRole('region', { name: 'Suite du classement' });
    fireEvent.click(within(rest).getByRole('button', { name: /Toi/ }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveAccessibleName('Tes points');
    expect(await within(sheet).findByText('Semaine 1')).toBeInTheDocument();
    expect(within(sheet).queryByText(/pts? provisoires?$/)).not.toBeInTheDocument();
    expect(within(sheet).queryByText('Semaines provisoires')).not.toBeInTheDocument();
    expect(asked).toEqual([mockMe.id]);

    fireEvent.click(within(sheet).getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('leads a participant of the challenge to the activities from the sheet', async () => {
    answer();
    leaderboard();
    breakdown();
    const router = renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    fireEvent.click(await within(sheet).findByRole('link', { name: 'Voir les activités' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/challenges/${id}/participants/${JULIE}`),
    );
  });

  it('shows the ranks and points without the values nor the activities to a visitor', async () => {
    answer({ my_role: 'outsider', my_status: null });
    leaderboard();
    breakdown({
      weeks: [
        {
          ...week1,
          criteria: [
            ...week1.criteria,
            { criterion: 'fastest_run' as const, rank: 2, value: 300, points: 8 },
          ].map((criterion) => ({ ...criterion, value: null })),
        },
      ],
    });
    renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    const week = await within(sheet).findByRole('region', { name: 'Semaine 1' });
    expect(week).toHaveTextContent('Séance la plus longue en temps1er de la semaine10 pts');
    expect(week).toHaveTextContent('Sortie course la plus rapide2e de la semaine8 pts');
    expect(within(sheet).queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens the detail of a participant who abandoned, the acquired weeks only', async () => {
    answer();
    leaderboard();
    const asked = breakdown({ abandoned: true, provisional_points: null, weeks: [week1] });
    renderAt(`/challenges/${id}?category=points`);

    const out = await screen.findByRole('region', { name: 'Éliminés' });
    fireEvent.click(within(out).getByRole('button', { name: /leo/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Points de leo' });
    expect(
      await within(sheet).findByText("Abandon : seuls comptent les points acquis avant l'abandon."),
    ).toBeInTheDocument();
    expect(within(sheet).queryByText('Semaines provisoires')).not.toBeInTheDocument();
    expect(asked).toEqual(['10000000-0000-4000-8000-000000000003']);
  });

  it('keeps the abandon said in the frozen points of a finished challenge', async () => {
    answer({ status: 'finished', current_week: null, week_ends_at: null });
    leaderboard();
    breakdown({ abandoned: true, frozen: true, provisional_points: null, weeks: [week1] });
    renderAt(`/challenges/${id}?category=points`);

    const out = await screen.findByRole('region', { name: 'Éliminés' });
    fireEvent.click(within(out).getByRole('button', { name: /leo/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Points de leo' });
    expect(
      await within(sheet).findByText('Résultats définitifs : ces points ne bougeront plus.'),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText("Abandon : seuls comptent les points acquis avant l'abandon."),
    ).toBeInTheDocument();
  });

  it('shows the km equivalent to the reference sport, the meters climbed and the pace', async () => {
    answer();
    leaderboard();
    breakdown({
      weeks: [
        {
          ...week1,
          criteria: [
            { criterion: 'longest_distance', rank: 3, value: 12_500, points: 6 },
            { criterion: 'weekly_elevation', rank: 1, value: 1_250, points: 10 },
            { criterion: 'fastest_run', rank: 2, value: 292, points: 8 },
          ],
        },
      ],
    });
    renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    const week = await within(sheet).findByRole('region', { name: 'Semaine 1' });
    expect(week).toHaveTextContent(
      'Séance la plus longue en distance équivalente12,5 km éq. course · 3e de la semaine6 pts',
    );
    expect(week).toHaveTextContent(/D\+ de la semaine1\s250 m D\+ · 1er de la semaine10 pts/);
    expect(week).toHaveTextContent('Sortie course la plus rapide4:52 /km · 2e de la semaine8 pts');
  });

  it('does not open again by itself when coming back to the grand prix', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        ...pointsDetail.categories,
      ],
    });
    leaderboard();
    breakdown();
    const router = renderAt(`/challenges/${id}?category=points`);

    await open(/julie/);
    await router.navigate(`/challenges/${id}?category=cumulative_time`);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await router.navigate(`/challenges/${id}?category=points`);
    expect(await screen.findByRole('region', { name: 'Podium' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says when no week has points to show', async () => {
    answer();
    leaderboard();
    breakdown({ acquired_points: 0, provisional_points: null, weeks: [] });
    renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    expect(
      await within(sheet).findByText("Aucune semaine à détailler pour l'instant."),
    ).toBeInTheDocument();
  });

  it('shows the frozen points of a finished challenge', async () => {
    answer({ status: 'finished', current_week: null, week_ends_at: null });
    leaderboard();
    breakdown({ frozen: true, provisional_points: null, weeks: [week1] });
    renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    expect(
      await within(sheet).findByText('Résultats définitifs : ces points ne bougeront plus.'),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole('region', { name: 'Semaines acquises' })).toBeInTheDocument();
  });

  it('names the challenge time zone of the weeks when the device is elsewhere', async () => {
    vi.restoreAllMocks();
    deviceIn('Europe/Paris');
    answer();
    leaderboard();
    breakdown();
    renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    expect(
      await within(sheet).findByText(
        `Semaines à l'heure du défi : ${timeZoneName(summary.timezone, 'fr')}.`,
      ),
    ).toBeInTheDocument();
  });

  it('offers a retry when the detail cannot load', async () => {
    answer();
    leaderboard();
    let calls = 0;
    server.use(
      http.get('*/api/v1/challenges/:challengeId/participants/:userId/points', () => {
        calls += 1;
        if (calls === 1) {
          const body: ApiErrorBody = { error: { code: 'internal_error', message: 'boom' } };
          return HttpResponse.json(body, { status: 500 });
        }
        return HttpResponse.json<PointsBreakdown>({
          user_id: JULIE,
          computed_at: '2026-11-18T15:00:00Z',
          abandoned: false,
          frozen: false,
          acquired_points: 18,
          provisional_points: null,
          weeks: [week1],
        });
      }),
    );
    renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    expect(
      await within(sheet).findByText(
        'Le service est momentanément indisponible. Réessaie dans un instant.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Réessayer' }));
    expect(await within(sheet).findByText('18 pts acquis')).toBeInTheDocument();
  });

  it('keeps the other categories linking to the activities', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        ...pointsDetail.categories,
      ],
    });
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) =>
        HttpResponse.json<Leaderboard>(
          answerLeaderboard(
            '2026-11-18T15:00:00Z',
            [
              {
                type: 'cumulative_time',
                ranked_count: 0,
                entries: [entry('julie', JULIE, 1, 3_600)],
              },
            ],
            new URL(request.url).searchParams,
            mockMe.id,
          ),
        ),
      ),
    );
    renderAt(`/challenges/${id}?category=cumulative_time`);

    const podium = await screen.findByRole('region', { name: 'Podium' });
    expect(within(podium).getByRole('link', { name: /julie/ })).toBeInTheDocument();
  });

  it('speaks English', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, language: 'en' })));
    answer();
    leaderboard();
    breakdown();
    renderAt(`/challenges/${id}?category=points`);

    const sheet = await open(/julie/);
    expect(sheet).toHaveAccessibleName("julie's points");
    expect(await within(sheet).findByText('18 pts secured')).toBeInTheDocument();
    const week = within(sheet).getByRole('region', { name: 'Week 1' });
    expect(week).toHaveTextContent('1st of the week');
    expect(within(sheet).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
