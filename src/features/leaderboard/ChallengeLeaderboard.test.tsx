import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail, Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';
import { timeZoneName } from '../../domain/format/challengeDates';
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

let userCount = 0;

function entry(
  pseudo: string,
  rank: number | null,
  value: number | null,
  userId?: string,
): LeaderboardEntry {
  userCount += 1;
  return {
    rank,
    user: {
      id: userId ?? `10000000-0000-4000-8000-${String(userCount).padStart(12, '0')}`,
      pseudo,
      first_name: 'Alex',
      last_name: 'Gagnon',
      avatar: null,
    },
    value,
    abandoned: rank === null,
    elimination: null,
    provisional_points: null,
  };
}

// Ties in time (1, 1, 3), the user fourth, one participant who abandoned.
const time = [
  entry('julie', 1, 36_000),
  entry('marc', 1, 36_000),
  entry('sofia', 3, 3_900),
  entry('marie_92', 4, 2_700, mockMe.id),
  entry('leo', null, null),
];

function leaderboard(categories: FullRanking[]) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) =>
      HttpResponse.json<Leaderboard>(served(request, categories)),
    ),
  );
}

type Elimination = NonNullable<LeaderboardEntry['elimination']>;

/** A survivor or an eliminated one of the elimination, in week 3 by default. */
function runner(pseudo: string, rank: number, value: number, elimination: Partial<Elimination>) {
  return {
    ...entry(pseudo, rank, value),
    elimination: {
      status: null,
      eliminated_week: null,
      minimum_meters: null,
      distance_meters: 0,
      week_ends_at: '2026-11-23T05:00:00Z',
      ...elimination,
    },
  };
}

const threeCategories: FullRanking[] = [
  { type: 'cumulative_time', ranked_count: 0, entries: time },
  { type: 'cumulative_distance', ranked_count: 0, entries: [entry('nina', 1, 12_500)] },
  { type: 'elimination', ranked_count: 0, entries: [entry('hugo', 1, 8_000)] },
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** The leaderboard as the API answers the request (paginated with `limit`). */
function served(request: Request, categories: FullRanking[], computedAt = '2026-11-18T15:00:00Z') {
  return answerLeaderboard(computedAt, categories, new URL(request.url).searchParams, mockMe.id);
}

/** The categories of the challenge: the cumulative time and `other`. */
function timeAnd(other: 'elimination' | 'cumulative_elevation') {
  return {
    categories: [
      { type: 'cumulative_time', position: 1, params: {} },
      other === 'elimination'
        ? { type: 'elimination', position: 3, params: { sport: 'run', step_meters: 5_000 } }
        : { type: 'cumulative_elevation', position: 5, params: {} },
    ],
  } satisfies Partial<ChallengeDetail>;
}

const section = (name: string) => screen.findByRole('region', { name });

describe('ChallengeLeaderboard', () => {
  it('shows the podium and the full ranking with ties sharing a rank', async () => {
    answer();
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    const podium = within(await section('Podium')).getAllByRole('listitem');
    expect(podium).toHaveLength(3);
    const [first, second, third] = podium as [HTMLElement, HTMLElement, HTMLElement];
    for (const [card, name] of [
      [first, 'julie'],
      [second, 'marc'],
    ] as const) {
      expect(within(card).getByText('1er', { exact: false })).toBeInTheDocument();
      expect(within(card).getByText('ex æquo')).toBeInTheDocument();
      expect(within(card).getByText(name)).toBeInTheDocument();
      expect(within(card).getByText('10:00')).toBeInTheDocument();
    }
    expect(third).toHaveTextContent('3e');
    expect(third).not.toHaveTextContent('ex æquo');
    expect(within(third).getByText('1:05')).toBeInTheDocument();

    // The podium's ranks are not repeated below it.
    const rows = within(await section('Suite du classement')).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('span')?.textContent)).toEqual(['4']);
  });

  it('highlights the user, named Toi, and keeps the row on screen', async () => {
    answer();
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    const rows = within(await section('Suite du classement')).getAllByRole('listitem');
    const mine = rows[0];
    expect(mine).toHaveTextContent('Toi');
    expect(mine).toHaveTextContent('0:45');
    expect(mine).toHaveClass('sticky');
  });

  it('leaves the rows off screen to the browser, the sticky row of the user aside', async () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      entry(`runner_${index + 1}`, index + 1, 100_000 - index),
    );
    answer();
    leaderboard([
      {
        type: 'cumulative_time',
        ranked_count: 0,
        entries: [...many, entry('marie_92', 31, 1_000, mockMe.id), entry('leo', null, null)],
      },
    ]);
    renderAt(`/challenges/${id}`);

    const rows = within(await section('Suite du classement')).getAllByRole('listitem');
    // Skipped, not removed: the browser's find and screen readers reach every
    // row (the first three are on the podium, then a page of 10 and the user's).
    expect(rows).toHaveLength(11);
    const mine = rows.at(-1);
    expect(mine).toHaveTextContent('Toi');
    expect(mine).toHaveClass('sticky');
    // Sticky positioning needs the row painted.
    expect(mine).not.toHaveClass('[content-visibility:auto]');
    for (const row of rows.slice(0, -1)) expect(row).toHaveClass('[content-visibility:auto]');
  });

  it('lists the participants who abandoned apart, without a rank nor the podium', async () => {
    answer();
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    const out = await section('Éliminés');
    expect(within(out).getByText('leo')).toBeInTheDocument();
    expect(within(out).getByText('A abandonné')).toBeInTheDocument();
    expect(within(await section('Podium')).queryByText('leo')).not.toBeInTheDocument();
    expect(within(await section('Suite du classement')).queryByText('leo')).not.toBeInTheDocument();
  });

  it('puts every participant of the first three ranks on the podium, ties included', async () => {
    answer();
    leaderboard([
      {
        type: 'cumulative_time',
        ranked_count: 0,
        entries: [
          entry('julie', 1, 9_000),
          entry('marc', 2, 8_000),
          entry('sofia', 3, 7_000),
          entry('hugo', 3, 7_000),
          entry('nina', 5, 6_000),
        ],
      },
    ]);
    renderAt(`/challenges/${id}`);

    const podium = await section('Podium');
    expect(within(podium).getAllByRole('listitem')).toHaveLength(4);
    expect(within(podium).queryByText('nina')).not.toBeInTheDocument();
  });

  it('shows the user who abandoned apart, named Toi, off the podium', async () => {
    answer({ my_role: 'abandoned', my_status: 'abandoned' });
    leaderboard([
      {
        type: 'cumulative_time',
        ranked_count: 0,
        entries: [entry('julie', 1, 9_000), entry('marie_92', null, null, mockMe.id)],
      },
    ]);
    renderAt(`/challenges/${id}`);

    const out = await section('Éliminés');
    expect(within(out).getByText('Toi')).toBeInTheDocument();
    expect(within(await section('Podium')).queryByText('Toi')).not.toBeInTheDocument();
    // Julie alone is ranked, on the podium: nothing follows.
    expect(screen.queryByRole('region', { name: 'Suite du classement' })).not.toBeInTheDocument();
  });

  it('shows only the participants who abandoned when no one is ranked', async () => {
    answer();
    leaderboard([
      { type: 'cumulative_time', ranked_count: 0, entries: [entry('leo', null, null)] },
    ]);
    renderAt(`/challenges/${id}`);

    expect(within(await section('Éliminés')).getByText('leo')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Podium' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Suite du classement' })).not.toBeInTheDocument();
  });

  it('shows each category with its own value, the choice kept in the address', async () => {
    // No « Où tu en es » for a visitor: a selector chooses the category.
    answer({ my_role: 'outsider', my_status: null });
    leaderboard(threeCategories);
    const router = renderAt(`/challenges/${id}`);

    const categories = within(
      await screen.findByRole('group', { name: 'Catégorie du classement' }),
    );
    expect(categories.getByRole('button', { name: 'Temps cumulé' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(categories.getByRole('button', { name: 'Distance cumulée' }));
    expect(within(await section('Podium')).getByText('12,5 km éq. course')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?category=cumulative_distance');

    fireEvent.click(categories.getByRole('button', { name: 'Course avec élimination' }));
    expect(within(await section('Podium')).getByText('8 km')).toBeInTheDocument();
  });

  it('names the reference sport of a cycling challenge in its tabs and values', async () => {
    answer({
      my_role: 'outsider',
      my_status: null,
      reference_sport: 'ride',
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        { type: 'cumulative_distance', position: 2, params: { factors: { ride: 1, run: 1 } } },
        { type: 'elimination', position: 3, params: { sport: 'ride', step_meters: 10_000 } },
      ],
    });
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}?category=cumulative_distance`);

    expect(within(await section('Podium')).getByText('12,5 km éq. vélo')).toBeInTheDocument();
    const categories = within(screen.getByRole('group', { name: 'Catégorie du classement' }));
    expect(categories.getByRole('button', { name: 'Vélo avec élimination' })).toBeInTheDocument();
  });

  it('shows two categories only, as the challenge has them', async () => {
    answer({ my_role: 'outsider', my_status: null, ...timeAnd('elimination') });
    leaderboard([
      { type: 'cumulative_time', ranked_count: 0, entries: time },
      { type: 'elimination', ranked_count: 0, entries: [entry('hugo', 1, 8_000)] },
    ]);
    renderAt(`/challenges/${id}`);

    const categories = within(
      await screen.findByRole('group', { name: 'Catégorie du classement' }),
    );
    expect(categories.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Temps cumulé',
      'Course avec élimination',
    ]);
  });

  it('shows the meters climbed of the total elevation gain, ties sharing a rank', async () => {
    answer({ my_role: 'outsider', my_status: null, ...timeAnd('cumulative_elevation') });
    leaderboard([
      { type: 'cumulative_time', ranked_count: 0, entries: time },
      {
        type: 'cumulative_elevation',
        ranked_count: 0,
        entries: [
          entry('julie', 1, 1_250),
          entry('marc', 1, 1_250),
          entry('sofia', 3, 420),
          // Without any elevation gain entered: ranked on 0 m.
          entry('nina', 4, 0),
          entry('leo', null, null),
        ],
      },
    ]);
    renderAt(`/challenges/${id}?category=cumulative_elevation`);

    const podium = within(await section('Podium')).getAllByRole('listitem');
    const [first, second, third] = podium as [HTMLElement, HTMLElement, HTMLElement];
    expect(first).toHaveTextContent('1er');
    expect(first).toHaveTextContent('ex æquo');
    expect(first).toHaveTextContent('1 250 m D+');
    expect(second).toHaveTextContent('1er');
    expect(second).toHaveTextContent('1 250 m D+');
    expect(third).toHaveTextContent('3e');
    expect(third).toHaveTextContent('420 m D+');
    expect(within(await section('Suite du classement')).getByText('0 m D+')).toBeInTheDocument();
    const out = within(await section('Éliminés'));
    expect(out.getByText('A abandonné')).toBeInTheDocument();
    expect(out.queryByText(/m D\+/)).not.toBeInTheDocument();
    // The challenge's page names the categories too: the leaderboard's own words.
    expect(
      within(await section('Classement · D+ cumulé')).getByText(
        'Le dénivelé positif de toutes les activités qui en ont un, tous sports confondus, en mètres réels, sans coefficient.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'D+ cumulé' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers no total elevation gain to a challenge without it', async () => {
    answer({ my_role: 'outsider', my_status: null });
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}?category=cumulative_elevation`);

    // The address asks for a category the challenge lacks: the first one is shown.
    const categories = within(
      await screen.findByRole('group', { name: 'Catégorie du classement' }),
    );
    expect(categories.queryByRole('button', { name: 'D+ cumulé' })).not.toBeInTheDocument();
    expect(categories.getByRole('button', { name: 'Temps cumulé' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText(/m D\+/)).not.toBeInTheDocument();
  });

  it('offers no category choice when the challenge has the cumulative time only', async () => {
    answer({ categories: [{ type: 'cumulative_time', position: 1, params: {} }] });
    leaderboard([{ type: 'cumulative_time', ranked_count: 0, entries: time }]);
    // A category the challenge lacks falls back on its first one.
    renderAt(`/challenges/${id}?category=elimination`);

    expect(await section('Podium')).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Catégorie du classement' }),
    ).not.toBeInTheDocument();
    // Named in the title of its ranking.
    expect(
      screen.getByRole('heading', { level: 2, name: 'Classement · Temps cumulé' }),
    ).toBeInTheDocument();
  });

  it('opens the activities of a participant for a participant of the challenge', async () => {
    answer();
    leaderboard(threeCategories);
    const router = renderAt(`/challenges/${id}?category=elimination`);

    fireEvent.click(within(await section('Podium')).getByRole('link', { name: /hugo/ }));
    // Once the code of the participant's page has loaded.
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(
        new RegExp(`^/challenges/${id}/participants/[0-9a-f-]+$`),
      ),
    );
  });

  it('does not link to the activities for a visitor of a public challenge', async () => {
    answer({ my_role: 'outsider', my_status: null });
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    const ranking = await section('Classement · Temps cumulé');
    expect(await within(ranking).findByText('julie')).toBeInTheDocument();
    expect(within(ranking).queryByRole('link')).not.toBeInTheDocument();
  });

  it('says when no one is ranked yet', async () => {
    answer();
    leaderboard([
      { type: 'cumulative_time', ranked_count: 0, entries: [] },
      { type: 'cumulative_distance', ranked_count: 0, entries: [] },
      { type: 'elimination', ranked_count: 0, entries: [] },
    ]);
    renderAt(`/challenges/${id}`);

    expect(
      await screen.findByText("Personne n'est encore classé dans ce défi."),
    ).toBeInTheDocument();
  });

  it('shows the loading state until the leaderboard arrives', async () => {
    answer();
    let release: () => void = () => undefined;
    const sent = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', async ({ request }) => {
        await sent;
        return HttpResponse.json<Leaderboard>(
          served(request, threeCategories, '2026-11-18T15:00:00Z'),
        );
      }),
    );
    renderAt(`/challenges/${id}`);

    // The challenge is shown; its leaderboard is still on the way.
    expect(
      await screen.findByRole('heading', { level: 1, name: summary.title }),
    ).toBeInTheDocument();
    // The page's other statuses (an abandon being sent) are empty.
    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
    release();
    expect(await section('Podium')).toBeInTheDocument();
    expect(screen.queryByRole('status', { busy: true })).not.toBeInTheDocument();
  });

  it('offers a retry when the leaderboard cannot load', async () => {
    answer();
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', () =>
        HttpResponse.json({ error: { code: 'internal_error', message: 'Boom' } }, { status: 500 }),
      ),
    );
    renderAt(`/challenges/${id}`);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    leaderboard(threeCategories);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await section('Podium')).toBeInTheDocument();
  });
});

/** The device in a time zone: the challenge's one, unless said otherwise. */
function deviceIn(timeZone: string) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone };
  });
}

describe('ChallengeLeaderboard, refresh', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('says when the server computed the leaderboard, in the challenge time zone', async () => {
    deviceIn(summary.timezone);
    answer();
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    expect(await screen.findByText('Classements mis à jour : 18 nov., 10:00')).toBeInTheDocument();
  });

  it('names the challenge time zone when the device is elsewhere', async () => {
    deviceIn('Europe/Paris');
    answer();
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    // Named with the end of the week and with the time of the computation.
    expect(
      await screen.findByText(
        'Semaine 3 · se termine lundi 23 novembre à 00 h, heure de l’Est nord-américain',
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Classements mis à jour : 18 nov., 10:00, heure de l’Est nord-américain',
      ),
    ).toBeInTheDocument();
  });

  it('reloads when the page comes back into view, not before it is stale', async () => {
    deviceIn(summary.timezone);
    // Only the clock is faked: the requests and the rendering keep their timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T15:00:30Z'));
    answer();
    let computedAt = '2026-11-18T15:00:00Z';
    // The banner's whole leaderboard, and the page of the category shown.
    const calls = { whole: 0, paged: 0 };
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) => {
        calls[new URL(request.url).searchParams.has('limit') ? 'paged' : 'whole'] += 1;
        return HttpResponse.json<Leaderboard>(served(request, threeCategories, computedAt));
      }),
    );
    renderAt(`/challenges/${id}`);
    expect(await screen.findByText('Classements mis à jour : 18 nov., 10:00')).toBeInTheDocument();
    await waitFor(() => expect(calls).toEqual({ whole: 1, paged: 1 }));

    const comeBack = () =>
      act(() => void document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
    computedAt = '2026-11-18T15:20:00Z';
    comeBack();
    // Still fresh: no request, the time stays.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toEqual({ whole: 1, paged: 1 });
    expect(screen.getByText('Classements mis à jour : 18 nov., 10:00')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-11-18T15:20:30Z'));
    comeBack();
    expect(await screen.findByText('Classements mis à jour : 18 nov., 10:20')).toBeInTheDocument();
    await waitFor(() => expect(calls).toEqual({ whole: 2, paged: 2 }));
  });
});

describe('ChallengeLeaderboard, finished challenge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const finished = { status: 'finished', current_week: null, week_ends_at: null } as const;

  it('says the results are final, with the last day and its year in the challenge time zone', async () => {
    deviceIn(summary.timezone);
    answer(finished);
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    expect(
      await screen.findByText("Résultats définitifs : le défi s'est terminé le 29 nov. 2026"),
    ).toBeInTheDocument();
    // Frozen: no update time to follow.
    expect(screen.queryByText(/mis à jour/)).not.toBeInTheDocument();
    expect(within(await section('Podium')).getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows the frozen meters of the total elevation gain once the challenge is finished', async () => {
    deviceIn(summary.timezone);
    answer({ ...finished, ...timeAnd('cumulative_elevation') });
    leaderboard([
      { type: 'cumulative_time', ranked_count: 0, entries: time },
      {
        type: 'cumulative_elevation',
        ranked_count: 2,
        entries: [entry('julie', 1, 2_300), entry('marc', 2, 900)],
      },
    ]);
    renderAt(`/challenges/${id}?category=cumulative_elevation`);

    expect(
      await screen.findByText("Résultats définitifs : le défi s'est terminé le 29 nov. 2026"),
    ).toBeInTheDocument();
    expect(within(await section('Podium')).getByText('2 300 m D+')).toBeInTheDocument();
  });

  it('names the challenge time zone when the device is elsewhere', async () => {
    deviceIn('Europe/Paris');
    answer(finished);
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    expect(
      await screen.findByText(
        "Résultats définitifs : le défi s'est terminé le 29 nov. 2026, heure de l’Est nord-américain",
      ),
    ).toBeInTheDocument();
  });

  // The whole page is rendered: the participation block is under test too.
  it.each([
    ['an active participant', { my_role: 'participant', my_status: 'active' }],
    ['a visitor', { my_role: 'outsider', my_status: null }],
  ] as const)('offers neither joining nor abandoning to %s, read only', async (_, detail) => {
    deviceIn(summary.timezone);
    answer({ ...finished, ...detail, can_join: false });
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    expect(await screen.findByText(/Résultats définitifs/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejoindre le défi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abandonner le défi' })).not.toBeInTheDocument();
  });

  it('shows no final mention while the challenge is ongoing', async () => {
    answer({ status: 'ongoing' });
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    expect(await screen.findByText(/mis à jour/)).toBeInTheDocument();
    expect(screen.queryByText(/Résultats définitifs/)).not.toBeInTheDocument();
  });
});

describe('ChallengeLeaderboard, elimination', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const at = `/challenges/${id}?category=elimination`;
  const board = () => section('Classement · Course avec élimination');

  it('shows each live status with its icon, the minimum, the distance run and the week end', async () => {
    answer({ current_week: 3 });
    leaderboard([
      {
        type: 'elimination',
        ranked_count: 0,
        entries: [
          runner('julie', 4, 30_000, {
            status: 'reached',
            minimum_meters: 10_000,
            distance_meters: 12_000,
          }),
          runner('marc', 5, 25_000, {
            status: 'in_progress',
            minimum_meters: 10_000,
            distance_meters: 4_500,
          }),
          runner('sofia', 6, 20_000, {
            status: 'at_risk',
            minimum_meters: 9_000,
            distance_meters: 2_000,
          }),
        ],
      },
    ]);
    renderAt(at);

    const rows = within(await section('Suite du classement')).getAllByRole('listitem');
    const [reached, running, risk] = rows as [HTMLElement, HTMLElement, HTMLElement];
    for (const [row, label, progress] of [
      [reached, 'Objectif atteint', '12 km sur 10 km cette semaine'],
      [running, 'En cours', '4,5 km sur 10 km cette semaine'],
      [risk, 'À risque', '2 km sur 9 km cette semaine'],
    ] as const) {
      // Never the colour alone: a label with its icon.
      const pill = within(row).getByText(label);
      expect(pill.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(within(row).getByText(progress)).toBeInTheDocument();
    }
    expect(risk.firstElementChild).toHaveClass('border-risk-border');
    expect(reached.firstElementChild).not.toHaveClass('border-risk-border');
    expect(
      // The hour of the challenge's time zone, whatever the device's, in the page's banner.
      screen.getByText(/^Semaine 3 · se termine lundi 23 novembre à 00 h/),
    ).toBeInTheDocument();
  });

  it.each([
    ['America/Montreal', /^Semaine 3 · se termine lundi 23 novembre à 00 h$/],
    ['Europe/Paris', /^Semaine 3 · se termine lundi 23 novembre à 00 h, \S/],
  ])(
    'names the time zone of the week end only when the device is elsewhere (%s)',
    async (device, text) => {
      const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
        this: Intl.DateTimeFormat,
      ) {
        return { ...resolved.call(this), timeZone: device };
      });
      answer({ current_week: 3 });
      leaderboard([
        {
          type: 'elimination',
          ranked_count: 0,
          entries: [runner('julie', 1, 30_000, { status: 'reached', minimum_meters: 10_000 })],
        },
      ]);
      renderAt(at);

      expect(await screen.findByText(text)).toBeInTheDocument();
    },
  );

  it('explains how the minimum moves, with the X of the challenge', async () => {
    answer({ current_week: 3 });
    leaderboard([
      {
        type: 'elimination',
        ranked_count: 0,
        entries: [runner('julie', 1, 30_000, { status: 'reached', minimum_meters: 10_000 })],
      },
    ]);
    renderAt(at);

    expect(
      await screen.findByText(
        'Le minimum de la semaine suivante = ta distance de cette semaine + 2 km. Si tu fais plus que le minimum, ta distance devient la nouvelle base.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no minimum nor status in week 1, and says so', async () => {
    answer({ current_week: 1 });
    leaderboard([
      {
        type: 'elimination',
        ranked_count: 0,
        entries: [runner('julie', 4, 6_000, { distance_meters: 6_000 })],
      },
    ]);
    renderAt(at);

    expect(
      await screen.findByText(
        "Pas d'élimination en semaine 1 : le premier minimum s'applique en semaine 2.",
      ),
    ).toBeInTheDocument();
    const ranking = await section('Suite du classement');
    expect(within(ranking).queryByText(/cette semaine/)).not.toBeInTheDocument();
    expect(
      within(ranking).queryByText(/Objectif atteint|En cours|À risque/),
    ).not.toBeInTheDocument();
  });

  it('lists the eliminated apart with their week, still ranked in the other categories', async () => {
    answer({ current_week: 3 });
    const hugo = '10000000-0000-4000-8000-000000000999';
    leaderboard([
      { type: 'cumulative_time', ranked_count: 0, entries: [entry('hugo', 1, 9_000, hugo)] },
      {
        type: 'elimination',
        ranked_count: 0,
        entries: [
          runner('julie', 1, 30_000, { status: 'reached', minimum_meters: 10_000 }),
          {
            ...runner('hugo', 2, 8_000, {
              status: 'eliminated',
              eliminated_week: 2,
              week_ends_at: null,
            }),
            user: { ...entry('hugo', 2, 0).user, id: hugo },
          },
          entry('leo', null, null),
        ],
      },
    ]);
    renderAt(at);

    const out = within(await section('Éliminés')).getAllByRole('listitem');
    expect(out.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Éliminé en semaine 2'),
      expect.stringContaining('A abandonné'),
    ]);
    expect(out[0]).toHaveTextContent('hugo');
    expect(screen.queryByRole('region', { name: 'Suite du classement' })).not.toBeInTheDocument();
    expect(within(await section('Podium')).queryByText('hugo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Temps cumulé' }));
    expect(within(await section('Podium')).getByText('hugo')).toBeInTheDocument();
  });

  it('keeps the at risk status of the user, whose row is highlighted', async () => {
    answer({ current_week: 3 });
    leaderboard([
      {
        type: 'elimination',
        ranked_count: 0,
        entries: [
          {
            ...runner('marie_92', 4, 9_000, {
              status: 'at_risk',
              minimum_meters: 9_000,
              distance_meters: 3_000,
            }),
            user: { ...entry('marie_92', 4, 0).user, id: mockMe.id },
          },
        ],
      },
    ]);
    renderAt(at);

    const [mine] = within(await section('Suite du classement')).getAllByRole('listitem');
    expect(mine).toHaveTextContent('Toi');
    expect(within(mine as HTMLElement).getByText('À risque')).toBeInTheDocument();
  });

  it('shows the eliminated user apart, named Toi, with the week', async () => {
    answer({ current_week: 3 });
    leaderboard([
      {
        type: 'elimination',
        ranked_count: 0,
        entries: [
          runner('julie', 1, 30_000, { status: 'reached', minimum_meters: 10_000 }),
          {
            ...runner('marie_92', 2, 8_000, {
              status: 'eliminated',
              eliminated_week: 2,
              week_ends_at: null,
            }),
            user: { ...entry('marie_92', 2, 0).user, id: mockMe.id },
          },
        ],
      },
    ]);
    renderAt(at);

    const [mine] = within(await section('Éliminés')).getAllByRole('listitem');
    expect(mine).toHaveTextContent('Toi');
    expect(mine).toHaveTextContent('Éliminé en semaine 2');
    expect(mine).not.toHaveClass('sticky');
    // Julie alone is ranked, on the podium: nothing follows.
    expect(screen.queryByRole('region', { name: 'Suite du classement' })).not.toBeInTheDocument();
  });

  it('shows neither status nor week end outside the weeks of the challenge', async () => {
    answer({ status: 'finished', current_week: null, week_ends_at: null });
    leaderboard([
      {
        type: 'elimination',
        ranked_count: 0,
        entries: [runner('julie', 4, 30_000, { week_ends_at: null })],
      },
    ]);
    renderAt(at);

    const ranking = await section('Suite du classement');
    expect(within(ranking).queryByText(/cette semaine/)).not.toBeInTheDocument();
    expect(screen.queryByText(/se termine/)).not.toBeInTheDocument();
    expect(within(await board()).queryByText(/Le minimum de la semaine/)).not.toBeInTheDocument();
  });
});

describe('ChallengeLeaderboard, eliminated after the end', () => {
  it('keeps the eliminated off the podium once the challenge is finished', async () => {
    answer({ status: 'finished', current_week: null, week_ends_at: null });
    leaderboard([
      {
        type: 'elimination',
        ranked_count: 1,
        entries: [
          runner('julie', 1, 30_000, { week_ends_at: null }),
          runner('hugo', 2, 40_000, {
            status: 'eliminated',
            eliminated_week: 2,
            week_ends_at: null,
          }),
        ],
      },
    ]);
    renderAt(`/challenges/${id}?category=elimination`);

    const podium = await section('Podium');
    expect(within(podium).getAllByRole('listitem')).toHaveLength(1);
    expect(within(podium).queryByText('hugo')).not.toBeInTheDocument();
    expect(within(await section('Éliminés')).getByText('hugo')).toBeInTheDocument();
  });
});

describe('ChallengeLeaderboard, points', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A participant of the points category, with their provisional points. */
  const scorer = (pseudo: string, rank: number, points: number, provisional: number | null) => ({
    ...entry(pseudo, rank, points),
    provisional_points: provisional,
  });

  const withPoints = (entries: LeaderboardEntry[]): FullRanking[] => [
    { type: 'cumulative_time', ranked_count: 0, entries: time },
    { type: 'points', ranked_count: 0, entries },
  ];

  const pointsDetail = {
    categories: [
      { type: 'cumulative_time', position: 1, params: {} },
      {
        type: 'points',
        position: 4,
        params: { criteria: ['longest_duration'], podium: 5 },
      },
    ],
  } satisfies Partial<ChallengeDetail>;

  it('shows the points acquired, ranked on them alone, and the provisional ones apart', async () => {
    deviceIn(summary.timezone);
    answer(pointsDetail);
    leaderboard(
      withPoints([
        // Ties on the points acquired (1, 1, 3), whatever the provisional ones.
        scorer('julie', 1, 43, 12),
        scorer('marc', 1, 43, 0),
        scorer('sofia', 3, 1, null),
        entry('leo', null, null),
      ]),
    );
    renderAt(`/challenges/${id}?category=points`);

    const podium = within(await section('Podium')).getAllByRole('listitem');
    const [first, second, third] = podium as [HTMLElement, HTMLElement, HTMLElement];
    expect(first).toHaveTextContent('1er');
    expect(first).toHaveTextContent('ex æquo');
    expect(within(first).getByText('+ 12 pts provisoires')).toBeInTheDocument();
    expect(first).toHaveTextContent('43 pts');
    // No provisional points to show: nothing apart.
    expect(second).toHaveTextContent('43 pts');
    expect(second).not.toHaveTextContent('provisoire');
    expect(third).toHaveTextContent('1 pt');
    expect(third).not.toHaveTextContent('provisoire');

    expect(first).toHaveTextContent('43 pts + 12 pts provisoires');
    expect(within(await section('Éliminés')).getByText('A abandonné')).toBeInTheDocument();
    expect(
      screen.getByText(
        `Les points d'une semaine sont acquis à 7 h le premier jour de la semaine suivante, heure du défi (${timeZoneName(summary.timezone, 'fr')}). D'ici là, ils sont provisoires et ne comptent pas dans le rang.`,
      ),
    ).toBeInTheDocument();
  });

  it('shows the final points alone once the challenge is finished', async () => {
    deviceIn(summary.timezone);
    answer({ ...pointsDetail, status: 'finished', current_week: null, week_ends_at: null });
    leaderboard(withPoints([scorer('julie', 1, 55, null), scorer('marc', 2, 40, null)]));
    renderAt(`/challenges/${id}?category=points`);

    expect(within(await section('Podium')).getByText('55 pts')).toBeInTheDocument();
    expect(screen.queryByText(/provisoire/)).not.toBeInTheDocument();
  });

  it('keeps the provisional points and their rule after the end, until the last week locks', async () => {
    deviceIn(summary.timezone);
    answer({ ...pointsDetail, status: 'finished', current_week: null, week_ends_at: null });
    leaderboard(withPoints([scorer('julie', 1, 43, 10), scorer('marc', 2, 40, null)]));
    renderAt(`/challenges/${id}?category=points`);

    expect(within(await section('Podium')).getByText('+ 10 pts provisoires')).toBeInTheDocument();
    expect(screen.getByText(/^Les points d'une semaine sont acquis à 7 h/)).toBeInTheDocument();
  });
});

describe('ChallengeLeaderboard, podium then pages', () => {
  afterEach(async () => {
    await i18n.changeLanguage('fr');
  });

  /**
   * 24 ranked (1, 2, 3, 3, 5…24: a tie at the third rank), the user at
   * `myRank` (none: not a participant), then two who abandoned.
   */
  function longRanking(
    type: 'cumulative_time' | 'cumulative_distance',
    myRank: number | null,
  ): FullRanking {
    const ranked = Array.from({ length: 24 }, (_, index) => {
      const rank = index === 3 ? 3 : index + 1;
      const userId = rank === myRank && index !== 3 ? mockMe.id : undefined;
      return entry(
        `p${index + 1}`,
        rank,
        100_000 - Math.min(index, 2) * 1_000 - index * 1_000,
        userId,
      );
    });
    const tied = ranked[2];
    if (ranked[3] && tied) ranked[3] = { ...ranked[3], value: tied.value };
    return {
      type,
      ranked_count: 24,
      entries: [...ranked, entry('zoe', null, null), entry('yann', null, null)],
    };
  }

  /** Serves `categories`, paginated, and records every request. */
  function recorded(categories: FullRanking[]) {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) => {
        const query = new URL(request.url).searchParams;
        if (query.has('limit')) requests.push(query);
        return HttpResponse.json<Leaderboard>(served(request, categories));
      }),
    );
    return requests;
  }

  const ranks = async () =>
    within(await section('Suite du classement'))
      .getAllByRole('listitem')
      .map((row) => row.querySelector('span')?.textContent);

  it('shows the whole podium, the tie at the third rank included, then a page of 10', async () => {
    answer({ my_role: 'outsider', my_status: null });
    const requests = recorded([longRanking('cumulative_time', null)]);
    renderAt(`/challenges/${id}`);

    const podium = within(await section('Podium')).getAllByRole('listitem');
    expect(podium.map((card) => card.querySelector('span')?.firstChild?.textContent)).toEqual([
      '1er',
      '2e',
      '3e',
      '3e',
    ]);
    expect(podium[2]).toHaveTextContent('ex æquo');
    expect(await ranks()).toEqual(['5', '6', '7', '8', '9', '10', '11', '12', '13', '14']);
    expect(requests[0]?.get('category')).toBe('cumulative_time');
    expect(requests[0]?.get('limit')).toBe('10');
    expect(requests[0]?.has('cursor')).toBe(false);
    // Not a participant: no line of « Toi ».
    expect(screen.queryByText('Toi')).not.toBeInTheDocument();
  });

  it('loads the pages after the podium one after the other, those who abandoned last', async () => {
    answer({ my_role: 'outsider', my_status: null });
    const requests = recorded([longRanking('cumulative_time', null)]);
    renderAt(`/challenges/${id}`);

    await section('Suite du classement');
    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));
    await waitFor(async () => expect(await ranks()).toHaveLength(20));
    expect(requests.at(-1)?.get('cursor')).toBe('10');
    expect(screen.queryByRole('region', { name: 'Éliminés' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));
    const out = within(await section('Éliminés')).getAllByRole('listitem');
    expect(out.map((row) => row.textContent)).toEqual([
      expect.stringContaining('zoe'),
      expect.stringContaining('yann'),
    ]);
    expect(requests.at(-1)?.get('cursor')).toBe('20');
    // The podium stays whole, never repeated below it.
    expect(within(await section('Podium')).getAllByRole('listitem')).toHaveLength(4);
    expect((await ranks()).at(0)).toBe('5');
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  it('reads every line after the podium with « Tout », and keeps the choice', async () => {
    answer({ my_role: 'outsider', my_status: null });
    const requests = recorded([longRanking('cumulative_time', null)]);
    renderAt(`/challenges/${id}`);

    await section('Suite du classement');
    fireEvent.click(screen.getByRole('radio', { name: 'Tout' }));

    expect(await section('Éliminés')).toBeInTheDocument();
    expect(await ranks()).toHaveLength(20);
    expect(requests.at(-1)?.get('limit')).toBe('100');
    expect(within(await section('Podium')).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
    expect(localStorage.getItem('sport-challenge:page-size:leaderboard')).toBe('all');
  });

  it('keeps the size chosen when another category is shown', async () => {
    answer({ my_role: 'outsider', my_status: null });
    const requests = recorded([
      longRanking('cumulative_time', null),
      longRanking('cumulative_distance', null),
      { type: 'elimination', ranked_count: 0, entries: [] },
    ]);
    renderAt(`/challenges/${id}`);

    await section('Suite du classement');
    fireEvent.click(screen.getByRole('radio', { name: '50' }));
    await waitFor(async () => expect(await ranks()).toHaveLength(20));
    fireEvent.click(screen.getByRole('button', { name: 'Distance cumulée' }));

    await screen.findByRole('heading', { name: 'Classement · Distance cumulée' });
    await waitFor(() => expect(requests.at(-1)?.get('category')).toBe('cumulative_distance'));
    expect(requests.at(-1)?.get('limit')).toBe('50');
    expect(screen.getByRole('radio', { name: '50' })).toBeChecked();
  });

  it('shows the user on the podium once, not below it', async () => {
    answer();
    recorded([longRanking('cumulative_time', 2)]);
    renderAt(`/challenges/${id}`);

    const podium = within(await section('Podium')).getAllByRole('listitem');
    expect(podium[1]).toHaveTextContent('Toi');
    await section('Suite du classement');
    expect(screen.getAllByText('Toi')).toHaveLength(1);
  });

  it('shows the user in the loaded page once, kept on screen', async () => {
    answer();
    recorded([longRanking('cumulative_time', 8)]);
    renderAt(`/challenges/${id}`);

    const rows = within(await section('Suite du classement')).getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    expect(rows[3]).toHaveTextContent('Toi');
    expect(rows[3]).toHaveClass('sticky');
    expect(screen.getAllByText('Toi')).toHaveLength(1);
  });

  it('shows the user apart, with the rank, until the page that holds it is loaded', async () => {
    answer();
    recorded([longRanking('cumulative_time', 20)]);
    renderAt(`/challenges/${id}`);

    const rows = within(await section('Suite du classement')).getAllByRole('listitem');
    expect(rows).toHaveLength(11);
    const mine = rows.at(-1);
    expect(mine).toHaveTextContent('Toi');
    expect(mine?.querySelector('span')?.textContent).toBe('20');
    expect(mine).toHaveClass('sticky');

    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));
    await waitFor(async () => expect(await ranks()).toHaveLength(20));
    // In its place now, once only.
    expect((await ranks()).indexOf('20')).toBe(15);
    expect(screen.getAllByText('Toi')).toHaveLength(1);
  });

  it('shows the user who abandoned apart, before the page of those who abandoned', async () => {
    answer({ my_role: 'abandoned', my_status: 'abandoned' });
    const ranking = longRanking('cumulative_time', null);
    ranking.entries.push(entry('marie_92', null, null, mockMe.id));
    recorded([ranking]);
    renderAt(`/challenges/${id}`);

    const out = within(await section('Éliminés')).getAllByRole('listitem');
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveTextContent('Toi');
    expect(out[0]).toHaveTextContent('A abandonné');
    expect(await ranks()).toHaveLength(10);
  });

  it('keeps the loaded lines and offers a retry when the next page fails', async () => {
    answer({ my_role: 'outsider', my_status: null });
    const categories = [longRanking('cumulative_time', null)];
    let fail = true;
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) => {
        if (fail && new URL(request.url).searchParams.has('cursor')) {
          return HttpResponse.json(
            { error: { code: 'internal_error', message: 'boom' } },
            { status: 500 },
          );
        }
        return HttpResponse.json<Leaderboard>(served(request, categories));
      }),
    );
    renderAt(`/challenges/${id}`);

    await section('Suite du classement');
    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(
      await screen.findByText("La suite n'a pas pu être chargée.", {}, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(await ranks()).toHaveLength(10);
    expect(within(await section('Podium')).getAllByRole('listitem')).toHaveLength(4);

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(async () => expect(await ranks()).toHaveLength(20));
  }, 10_000);

  it('starts again from the first page when the ranking changed since the cursor', async () => {
    answer({ my_role: 'outsider', my_status: null });
    const categories = [longRanking('cumulative_time', null)];
    const requests: URLSearchParams[] = [];
    let stale = true;
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) => {
        const query = new URL(request.url).searchParams;
        if (query.has('limit')) requests.push(query);
        if (stale && query.has('cursor')) {
          stale = false;
          return HttpResponse.json(
            { error: { code: 'cursor_invalid', message: 'Cursor invalid' } },
            { status: 400 },
          );
        }
        return HttpResponse.json<Leaderboard>(served(request, categories));
      }),
    );
    renderAt(`/challenges/${id}`);

    await section('Suite du classement');
    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));

    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2]?.has('cursor')).toBe(false);
    expect(await ranks()).toHaveLength(10);
    // Neither the failure of the list nor the banner of the app.
    expect(screen.queryByText("La suite n'a pas pu être chargée.")).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers a retry under the category, without the size choice, when the ranking fails', async () => {
    answer({ my_role: 'outsider', my_status: null });
    const categories = [longRanking('cumulative_time', null)];
    let fail = true;
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) => {
        if (fail && new URL(request.url).searchParams.has('limit')) {
          return HttpResponse.json(
            { error: { code: 'validation_failed', message: 'Invalid' } },
            { status: 400 },
          );
        }
        return HttpResponse.json<Leaderboard>(served(request, categories));
      }),
    );
    renderAt(`/challenges/${id}`);

    const ranking = await section('Classement · Temps cumulé');
    const retry = await within(ranking).findByRole('button', { name: 'Réessayer' });
    // The category stays chosen above the failure.
    expect(within(ranking).getByRole('group', { name: 'Catégorie du classement' })).toBeVisible();
    expect(within(ranking).queryByRole('radio')).not.toBeInTheDocument();

    fail = false;
    fireEvent.click(retry);
    expect(await section('Podium')).toBeInTheDocument();
    expect(within(ranking).getByRole('radio', { name: '10' })).toBeChecked();
  });

  it('leaves the podium out while nobody has scored, the tied lines below', async () => {
    answer({ my_role: 'outsider', my_status: null });
    recorded([
      {
        type: 'cumulative_time',
        ranked_count: 2,
        entries: [entry('julie', 1, 0), entry('marc', 1, 0)],
      },
    ]);
    renderAt(`/challenges/${id}`);

    expect(await ranks()).toEqual(['1 ex æquo', '1 ex æquo']);
    expect(screen.queryByRole('region', { name: 'Podium' })).not.toBeInTheDocument();
  });

  it('hides the size choice when no one is ranked', async () => {
    answer({ my_role: 'outsider', my_status: null });
    recorded([{ type: 'cumulative_time', ranked_count: 0, entries: [] }]);
    renderAt(`/challenges/${id}`);

    expect(
      await screen.findByText("Personne n'est encore classé dans ce défi."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('stops starting again when every cursor is refused, then retries from the first page', async () => {
    answer({ my_role: 'outsider', my_status: null });
    const categories = [longRanking('cumulative_time', null)];
    const requests: URLSearchParams[] = [];
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ request }) => {
        const query = new URL(request.url).searchParams;
        if (query.has('limit')) requests.push(query);
        if (query.has('cursor')) {
          return HttpResponse.json(
            { error: { code: 'cursor_invalid', message: 'Cursor invalid' } },
            { status: 400 },
          );
        }
        return HttpResponse.json<Leaderboard>(served(request, categories));
      }),
    );
    renderAt(`/challenges/${id}`);

    await section('Suite du classement');
    const firstPages = () => requests.filter((query) => !query.has('cursor')).length;
    // Each refused cursor starts again from the first page, twice in a row at most.
    for (const restarted of [2, 3]) {
      fireEvent.click(await screen.findByRole('button', { name: 'Charger plus' }));
      await waitFor(() => expect(firstPages()).toBe(restarted));
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Charger plus' }));
    const retry = await screen.findByRole('button', { name: 'Réessayer' });
    expect(screen.getByText("La suite n'a pas pu être chargée.")).toBeInTheDocument();
    expect(firstPages()).toBe(3);
    expect(await ranks()).toHaveLength(10);

    // The retry starts again too.
    fireEvent.click(retry);
    await waitFor(() => expect(firstPages()).toBe(4));
  });

  it('shows the frozen ranking of a finished challenge the same way', async () => {
    answer({ status: 'finished', current_week: null, week_ends_at: null });
    recorded([longRanking('cumulative_time', 20)]);
    renderAt(`/challenges/${id}`);

    expect(within(await section('Podium')).getAllByRole('listitem')).toHaveLength(4);
    expect(await ranks()).toHaveLength(11);
    expect(screen.getByRole('button', { name: 'Charger plus' })).toBeInTheDocument();
  });

  it('speaks English', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, language: 'en' })));
    answer();
    recorded([longRanking('cumulative_time', 20)]);
    renderAt(`/challenges/${id}`);

    const rows = within(await section('Rest of the ranking')).getAllByRole('listitem');
    expect(rows.at(-1)).toHaveTextContent('You');
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument();
  });
});
