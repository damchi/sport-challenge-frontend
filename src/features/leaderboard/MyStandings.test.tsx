import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail, Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges, mockMe } from '../../mocks/handlers';
import { answerLeaderboard, type FullRanking } from '../../mocks/leaderboard';
import { server } from '../../mocks/server';
import { routes } from '../../routes/routes';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;

// An ongoing challenge with the four categories, joined by the user.
const fourCategories: ChallengeDetail['categories'] = [
  { type: 'cumulative_time', position: 1, params: {} },
  { type: 'cumulative_distance', position: 2, params: { factors: { run: 1, ride: 0.3 } } },
  { type: 'elimination', position: 3, params: { sport: 'run', step_meters: 2000 } },
  { type: 'points', position: 4, params: { criteria: ['session_count'], podium: 5 } },
];

function answer(detail: Partial<ChallengeDetail> = {}) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () =>
      HttpResponse.json<ChallengeDetail>({
        ...mockChallengeDetail(summary),
        status: 'ongoing',
        my_role: 'participant',
        my_status: 'active',
        current_week: 3,
        week_ends_at: '2026-11-23T05:00:00Z',
        categories: fourCategories,
        ...detail,
      }),
    ),
  );
}

let userCount = 0;

/** A line of a category; the user's when `me`. */
function line(rank: number, value: number, me = false): LeaderboardEntry {
  userCount += 1;
  return {
    rank,
    user: {
      id: me ? mockMe.id : `10000000-0000-4000-8000-${String(userCount).padStart(12, '0')}`,
      pseudo: me ? 'marie_92' : `runner_${userCount}`,
      first_name: null,
      last_name: null,
      avatar: null,
    },
    value,
    abandoned: false,
    elimination: null,
    provisional_points: null,
  };
}

const myElimination = (elimination: Partial<NonNullable<LeaderboardEntry['elimination']>>) => ({
  ...line(5, 18_000, true),
  elimination: {
    status: 'at_risk' as const,
    eliminated_week: null,
    minimum_meters: 25_000,
    distance_meters: 18_000,
    week_ends_at: '2026-11-23T05:00:00Z',
    ...elimination,
  },
});

const fourRankings: FullRanking[] = [
  {
    type: 'cumulative_time',
    ranked_count: 8,
    entries: [line(1, 24_000), line(4, 15_120, true)],
  },
  {
    type: 'cumulative_distance',
    ranked_count: 8,
    entries: [line(1, 52_000), line(2, 41_800, true)],
  },
  { type: 'elimination', ranked_count: 6, entries: [line(1, 30_000), myElimination({})] },
  {
    type: 'points',
    ranked_count: 8,
    entries: [line(1, 25), { ...line(2, 19, true), provisional_points: 4 }],
  },
];

/** The leaderboard as the API answers the request (paginated with `limit`). */
function served(request: Request, categories: FullRanking[]) {
  return answerLeaderboard(
    '2026-11-18T15:00:00Z',
    categories,
    new URL(request.url).searchParams,
    mockMe.id,
  );
}

function leaderboard(categories: FullRanking[]) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) =>
      HttpResponse.json<Leaderboard>(served(request, categories)),
    ),
  );
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

const standings = () => screen.findByRole('region', { name: 'Où tu en es' });

/** The cards, as links, in the order of the categories. */
async function cards() {
  return within(await standings()).getAllByRole('link');
}

describe('MyStandings', () => {
  it('shows a card per category, in their order, with the user’s figures and rank', async () => {
    answer();
    leaderboard(fourRankings);
    renderAt(`/challenges/${id}`);

    const [time, distance, elimination, points] = (await cards()) as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(time).toHaveTextContent('Temps cumulé');
    expect(time).toHaveTextContent('4:12');
    expect(time).toHaveTextContent('tous sports confondus');
    expect(time).toHaveTextContent('4e sur 8');

    expect(distance).toHaveTextContent('Distance cumulée');
    expect(distance).toHaveTextContent('41,8 km');
    expect(distance).toHaveTextContent('en équivalent course');
    expect(distance).toHaveTextContent('2e sur 8');

    expect(elimination).toHaveTextContent('Course avec élimination');
    expect(elimination).toHaveTextContent('18 km / 25 km');
    expect(elimination).toHaveTextContent('en course, cette semaine');
    // Ranked among those still in the elimination, as the server counts them.
    expect(elimination).toHaveTextContent('5e sur 6');
    // Never the colour alone: the label with its icon, and the risk border.
    expect(within(elimination).getByText('À risque').querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(elimination).toHaveClass('border-risk-border');

    expect(points).toHaveTextContent('Grand prix');
    expect(points).toHaveTextContent('19 pts');
    expect(points).toHaveTextContent('+ 4 pts provisoires');
    expect(points).toHaveTextContent('2e sur 8');
  });

  it('shows the meters climbed and the rank of the total elevation gain', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        { type: 'cumulative_elevation', position: 5, params: {} },
      ],
    });
    leaderboard([
      { type: 'cumulative_time', ranked_count: 8, entries: [line(4, 15_120, true)] },
      {
        type: 'cumulative_elevation',
        ranked_count: 8,
        entries: [line(1, 1_250), line(1, 1_250, true)],
      },
    ]);
    renderAt(`/challenges/${id}`);

    const [, elevation] = (await cards()) as [HTMLElement, HTMLElement];
    expect(elevation).toHaveTextContent('D+ cumulé');
    expect(elevation).toHaveTextContent('1 250 m');
    expect(elevation).toHaveTextContent('de dénivelé positif, tous sports');
    // Tied with the first: the same rank.
    expect(elevation).toHaveTextContent('1er sur 8');
    expect(elevation).toHaveAttribute('href', `/challenges/${id}?category=cumulative_elevation`);
  });

  it('shows 0 m to a user without any elevation gain', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        { type: 'cumulative_elevation', position: 5, params: {} },
      ],
    });
    leaderboard([
      { type: 'cumulative_time', ranked_count: 2, entries: [line(1, 15_120, true)] },
      { type: 'cumulative_elevation', ranked_count: 2, entries: [line(1, 300), line(2, 0, true)] },
    ]);
    renderAt(`/challenges/${id}`);

    const [, elevation] = (await cards()) as [HTMLElement, HTMLElement];
    expect(elevation).toHaveTextContent('0 m');
    expect(elevation).toHaveTextContent('2e sur 2');
  });

  it('marks the category shown by the leaderboard, and a card chooses it', async () => {
    answer();
    leaderboard(fourRankings);
    const router = renderAt(`/challenges/${id}`);

    const [time, distance] = (await cards()) as [HTMLElement, HTMLElement];
    // The first one at first.
    expect(time).toHaveAttribute('aria-current', 'true');
    expect(time).toHaveClass('border-accent');
    expect(distance).not.toHaveAttribute('aria-current');
    // No other selector: the cards choose.
    expect(
      screen.queryByRole('group', { name: 'Catégorie du classement' }),
    ).not.toBeInTheDocument();

    fireEvent.click(distance);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Classement · Distance cumulée' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe('?category=cumulative_distance');
    const [, chosen] = await cards();
    expect(chosen).toHaveAttribute('aria-current', 'true');
  });

  it('leads back to the leaderboard from another section, marking none there', async () => {
    answer();
    leaderboard(fourRankings);
    const router = renderAt(`/challenges/${id}/activities`);

    const links = await cards();
    for (const link of links) expect(link).not.toHaveAttribute('aria-current');
    fireEvent.click(links[2] as HTMLElement);
    // Once the code of the leaderboard has loaded.
    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/challenges/${id}`));
    expect(router.state.location.search).toBe('?category=elimination');
  });

  it('says the week of the elimination of an eliminated user, without a rank', async () => {
    answer();
    leaderboard([
      fourRankings[0] as FullRanking,
      {
        type: 'elimination',
        ranked_count: 5,
        entries: [
          line(1, 30_000),
          // As the contract gives it: no distance of the week once eliminated.
          myElimination({
            status: 'eliminated',
            eliminated_week: 2,
            minimum_meters: null,
            distance_meters: 0,
            week_ends_at: null,
          }),
        ],
      },
    ]);
    renderAt(`/challenges/${id}`);

    const [, elimination] = (await cards()) as [HTMLElement, HTMLElement];
    expect(elimination).toHaveTextContent('Éliminé en semaine 2');
    // The distance ranked, not the week's (0).
    expect(elimination).toHaveTextContent('18 km');
    expect(elimination).not.toHaveTextContent('0 km');
    expect(elimination).not.toHaveTextContent(/sur 5/);
    expect(elimination).not.toHaveTextContent('À risque');
  });

  it('shows a single card for a challenge with the cumulative time only', async () => {
    answer({ categories: [{ type: 'cumulative_time', position: 1, params: {} }] });
    leaderboard([fourRankings[0] as FullRanking]);
    renderAt(`/challenges/${id}`);

    expect(await cards()).toHaveLength(1);
  });

  it.each([
    ['a visitor', { my_role: 'outsider', my_status: null }],
    ['a participant who abandoned', { my_role: 'abandoned', my_status: 'abandoned' }],
  ] as const)('is not shown to %s', async (_, detail) => {
    answer(detail);
    leaderboard(fourRankings);
    renderAt(`/challenges/${id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: summary.title }),
    ).toBeInTheDocument();
    // Once the leaderboard is there.
    expect(await screen.findByRole('region', { name: 'Podium' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Où tu en es' })).not.toBeInTheDocument();
    // Without cards, the leaderboard has its own category selector.
    expect(screen.getByRole('group', { name: 'Catégorie du classement' })).toBeInTheDocument();
  });

  it('is shown once the challenge is finished, with the total of the elimination', async () => {
    answer({ status: 'finished', current_week: null, week_ends_at: null });
    leaderboard([
      {
        type: 'elimination',
        ranked_count: 6,
        entries: [
          line(1, 30_000),
          // Outside the weeks: no status, no minimum, no distance of the week.
          myElimination({
            status: null,
            minimum_meters: null,
            distance_meters: 0,
            week_ends_at: null,
          }),
        ],
      },
    ]);
    renderAt(`/challenges/${id}`);

    const [elimination] = (await cards()) as [HTMLElement];
    expect(elimination).toHaveTextContent('18 km');
    expect(elimination).toHaveTextContent('5e sur 6');
    expect(elimination).not.toHaveTextContent('cette semaine');
  });

  describe('an elimination by repetitions', () => {
    const repetitionsChallenge = {
      reference_sport: 'crossfit',
      categories: [
        { type: 'cumulative_time' as const, position: 1, params: {} },
        {
          type: 'elimination' as const,
          position: 3,
          params: { sport: 'crossfit', exercise: 'burpee', step_repetitions: 20 },
        },
      ],
    };
    // As the contract gives it: no meters, the week in repetitions.
    const myRepetitions = (
      value: number,
      elimination: Partial<NonNullable<LeaderboardEntry['elimination']>>,
    ) => ({
      ...myElimination({ minimum_meters: null, distance_meters: 0, ...elimination }),
      value,
    });
    // The time first: the leaderboard shows it, the elimination's card keeps its own border.
    const repetitionsRanking = (me: LeaderboardEntry): FullRanking[] => [
      fourRankings[0] as FullRanking,
      { type: 'elimination', ranked_count: 6, entries: [line(1, 300), me] },
    ];

    it('shows the week in repetitions against its minimum, at risk', async () => {
      answer(repetitionsChallenge);
      leaderboard(
        repetitionsRanking(myRepetitions(150, { repetitions: 80, minimum_repetitions: 120 })),
      );
      renderAt(`/challenges/${id}`);

      const [, elimination] = (await cards()) as [HTMLElement, HTMLElement];
      expect(elimination).toHaveTextContent('Élimination · Burpees');
      expect(elimination).toHaveTextContent('80 rép. / 120 rép.');
      expect(elimination).toHaveTextContent('Burpees en CrossFit, cette semaine');
      expect(elimination).toHaveTextContent('5e sur 6');
      expect(within(elimination).getByText('À risque')).toBeInTheDocument();
      expect(elimination).toHaveClass('border-risk-border');
      expect(elimination.querySelector('.bg-risk-bar')).toHaveStyle({
        width: `${(80 / 120) * 100}%`,
      });
      expect(elimination).not.toHaveTextContent('km');
    });

    it('shows the total in repetitions in week 1, without a minimum', async () => {
      answer({ ...repetitionsChallenge, current_week: 1 });
      leaderboard(
        repetitionsRanking(
          myRepetitions(45, { status: 'in_progress', repetitions: 45, minimum_repetitions: null }),
        ),
      );
      renderAt(`/challenges/${id}`);

      const [, elimination] = (await cards()) as [HTMLElement, HTMLElement];
      expect(elimination).toHaveTextContent('45 rép.');
      expect(elimination).toHaveTextContent('Burpees en CrossFit');
      expect(elimination).not.toHaveTextContent('cette semaine');
      expect(elimination).not.toHaveTextContent('/');
    });

    it('shows the total in repetitions once the challenge is finished', async () => {
      answer({
        ...repetitionsChallenge,
        status: 'finished',
        current_week: null,
        week_ends_at: null,
      });
      leaderboard(
        repetitionsRanking(
          myRepetitions(150, {
            status: null,
            week_ends_at: null,
            repetitions: 0,
            minimum_repetitions: null,
          }),
        ),
      );
      renderAt(`/challenges/${id}`);

      const [, elimination] = (await cards()) as [HTMLElement, HTMLElement];
      expect(elimination).toHaveTextContent('150 rép.');
      expect(elimination).toHaveTextContent('Burpees en CrossFit');
      expect(elimination).toHaveTextContent('5e sur 6');
    });

    it('writes the repetitions in English, singular and plural', async () => {
      server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, language: 'en' })));
      answer(repetitionsChallenge);
      leaderboard(
        repetitionsRanking(myRepetitions(150, { repetitions: 1, minimum_repetitions: 2 })),
      );
      renderAt(`/challenges/${id}`);

      const elimination = within(
        await screen.findByRole('region', { name: 'Where you stand' }),
      ).getAllByRole('link')[1];
      expect(elimination).toHaveTextContent('Elimination · Burpees');
      expect(elimination).toHaveTextContent('1 rep / 2 reps');
      expect(elimination).toHaveTextContent('Burpees in CrossFit, this week');
    });
  });
});
