import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail, Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';
import { timeZoneName } from '../../domain/format/challengeDates';
import { mockChallengeDetail, mockChallenges, mockMe } from '../../mocks/handlers';
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

function leaderboard(categories: Leaderboard['categories']) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/leaderboard', () =>
      HttpResponse.json<Leaderboard>({ computed_at: '2026-11-18T15:00:00Z', categories }),
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

const threeCategories: Leaderboard['categories'] = [
  { type: 'cumulative_time', entries: time },
  { type: 'cumulative_distance', entries: [entry('nina', 1, 12_500)] },
  { type: 'elimination', entries: [entry('hugo', 1, 8_000)] },
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

    const rows = within(await section('Classement complet')).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('span')?.textContent)).toEqual([
      '1 ex æquo',
      '1 ex æquo',
      '3',
      '4',
    ]);
  });

  it('highlights the user, named Toi, and keeps the row on screen', async () => {
    answer();
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    const rows = within(await section('Classement complet')).getAllByRole('listitem');
    const mine = rows[3];
    expect(mine).toHaveTextContent('Toi');
    expect(mine).toHaveTextContent('0:45');
    expect(mine).toHaveClass('sticky');
    expect(rows[0]).not.toHaveClass('sticky');
  });

  it('leaves the rows off screen to the browser, the sticky row of the user aside', async () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      entry(`runner_${index + 1}`, index + 1, 100_000 - index),
    );
    answer();
    leaderboard([
      {
        type: 'cumulative_time',
        entries: [...many, entry('marie_92', 31, 1_000, mockMe.id), entry('leo', null, null)],
      },
    ]);
    renderAt(`/challenges/${id}`);

    const rows = within(await section('Classement complet')).getAllByRole('listitem');
    // Skipped, not removed: the browser's find and screen readers reach every row.
    expect(rows).toHaveLength(31);
    const mine = rows.at(-1);
    expect(mine).toHaveTextContent('Toi');
    expect(mine).toHaveClass('sticky');
    // Sticky positioning needs the row painted.
    expect(mine).not.toHaveClass('[content-visibility:auto]');
    const others = [
      ...rows.slice(0, -1),
      ...within(await section('Éliminés')).getAllByRole('listitem'),
    ];
    for (const row of others) expect(row).toHaveClass('[content-visibility:auto]');
  });

  it('lists the participants who abandoned apart, without a rank nor the podium', async () => {
    answer();
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    const out = await section('Éliminés');
    expect(within(out).getByText('leo')).toBeInTheDocument();
    expect(within(out).getByText('A abandonné')).toBeInTheDocument();
    expect(within(await section('Podium')).queryByText('leo')).not.toBeInTheDocument();
    expect(within(await section('Classement complet')).queryByText('leo')).not.toBeInTheDocument();
  });

  it('puts every participant of the first three ranks on the podium, ties included', async () => {
    answer();
    leaderboard([
      {
        type: 'cumulative_time',
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
        entries: [entry('julie', 1, 9_000), entry('marie_92', null, null, mockMe.id)],
      },
    ]);
    renderAt(`/challenges/${id}`);

    const out = await section('Éliminés');
    expect(within(out).getByText('Toi')).toBeInTheDocument();
    expect(within(await section('Podium')).queryByText('Toi')).not.toBeInTheDocument();
    expect(within(await section('Classement complet')).queryByText('Toi')).not.toBeInTheDocument();
  });

  it('shows only the participants who abandoned when no one is ranked', async () => {
    answer();
    leaderboard([{ type: 'cumulative_time', entries: [entry('leo', null, null)] }]);
    renderAt(`/challenges/${id}`);

    expect(within(await section('Éliminés')).getByText('leo')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Podium' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Classement complet' })).not.toBeInTheDocument();
  });

  it('shows each category with its own value, the choice kept in the address', async () => {
    answer();
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
    answer();
    leaderboard([
      { type: 'cumulative_time', entries: time },
      { type: 'elimination', entries: [entry('hugo', 1, 8_000)] },
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

  it('offers no category choice when the challenge has the cumulative time only', async () => {
    answer({ categories: [{ type: 'cumulative_time', position: 1, params: {} }] });
    leaderboard([{ type: 'cumulative_time', entries: time }]);
    // A category the challenge lacks falls back on its first one.
    renderAt(`/challenges/${id}?category=elimination`);

    expect(await section('Podium')).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Catégorie du classement' }),
    ).not.toBeInTheDocument();
    // Named once, above its ranking.
    expect(
      within(await section('Classement du défi')).getByText('Temps cumulé'),
    ).toBeInTheDocument();
  });

  it('opens the activities of a participant for a participant of the challenge', async () => {
    answer();
    leaderboard(threeCategories);
    const router = renderAt(`/challenges/${id}?category=elimination`);

    fireEvent.click(
      within(await section('Classement complet')).getByRole('link', { name: /hugo/ }),
    );
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

    const ranking = await section('Classement complet');
    expect(within(ranking).getByText('julie')).toBeInTheDocument();
    expect(within(ranking).queryByRole('link')).not.toBeInTheDocument();
  });

  it('says when no one is ranked yet', async () => {
    answer();
    leaderboard([
      { type: 'cumulative_time', entries: [] },
      { type: 'cumulative_distance', entries: [] },
      { type: 'elimination', entries: [] },
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
      http.get('*/api/v1/challenges/:challengeId/leaderboard', async () => {
        await sent;
        return HttpResponse.json<Leaderboard>({
          computed_at: '2026-11-18T15:00:00Z',
          categories: threeCategories,
        });
      }),
    );
    renderAt(`/challenges/${id}`);

    // The challenge is shown; its leaderboard is still on the way.
    expect(
      await screen.findByRole('heading', { level: 1, name: summary.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    release();
    expect(await section('Podium')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

    expect(await screen.findByText('Mis à jour : 18 nov., 10:00')).toBeInTheDocument();
  });

  it('names the challenge time zone when the device is elsewhere', async () => {
    deviceIn('Europe/Paris');
    answer();
    leaderboard(threeCategories);
    renderAt(`/challenges/${id}`);

    expect(
      await screen.findByText('Mis à jour : 18 nov., 10:00, heure de l’Est nord-américain'),
    ).toBeInTheDocument();
  });

  it('reloads when the page comes back into view, not before it is stale', async () => {
    deviceIn(summary.timezone);
    // Only the clock is faked: the requests and the rendering keep their timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T15:00:30Z'));
    answer();
    let computedAt = '2026-11-18T15:00:00Z';
    let calls = 0;
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', () => {
        calls += 1;
        return HttpResponse.json<Leaderboard>({
          computed_at: computedAt,
          categories: threeCategories,
        });
      }),
    );
    renderAt(`/challenges/${id}`);
    expect(await screen.findByText('Mis à jour : 18 nov., 10:00')).toBeInTheDocument();
    expect(calls).toBe(1);

    const comeBack = () =>
      act(() => void document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
    computedAt = '2026-11-18T15:20:00Z';
    comeBack();
    // Still fresh: no request, the time stays.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toBe(1);
    expect(screen.getByText('Mis à jour : 18 nov., 10:00')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-11-18T15:20:30Z'));
    comeBack();
    expect(await screen.findByText('Mis à jour : 18 nov., 10:20')).toBeInTheDocument();
    expect(calls).toBe(2);
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
    expect(screen.queryByText(/Mis à jour/)).not.toBeInTheDocument();
    expect(within(await section('Podium')).getAllByRole('listitem')).toHaveLength(3);
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

    expect(await screen.findByText(/Mis à jour/)).toBeInTheDocument();
    expect(screen.queryByText(/Résultats définitifs/)).not.toBeInTheDocument();
  });
});

describe('ChallengeLeaderboard, elimination', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const at = `/challenges/${id}?category=elimination`;
  const board = () => screen.findByRole('region', { name: 'Classement du défi' });

  it('shows each live status with its icon, the minimum, the distance run and the week end', async () => {
    answer({ current_week: 3 });
    leaderboard([
      {
        type: 'elimination',
        entries: [
          runner('julie', 1, 30_000, {
            status: 'reached',
            minimum_meters: 10_000,
            distance_meters: 12_000,
          }),
          runner('marc', 2, 25_000, {
            status: 'in_progress',
            minimum_meters: 10_000,
            distance_meters: 4_500,
          }),
          runner('sofia', 3, 20_000, {
            status: 'at_risk',
            minimum_meters: 9_000,
            distance_meters: 2_000,
          }),
        ],
      },
    ]);
    renderAt(at);

    const rows = within(await section('Classement complet')).getAllByRole('listitem');
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
      // The hour of the challenge's time zone, whatever the device's.
      within(await board()).getByText(/^Fin de la semaine : lundi 23 novembre à 00 h/),
    ).toBeInTheDocument();
  });

  it.each([
    ['America/Montreal', /^Fin de la semaine : lundi 23 novembre à 00 h$/],
    ['Europe/Paris', /^Fin de la semaine : lundi 23 novembre à 00 h, \S/],
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
          entries: [runner('julie', 1, 30_000, { status: 'reached', minimum_meters: 10_000 })],
        },
      ]);
      renderAt(at);

      expect(within(await board()).getByText(text)).toBeInTheDocument();
    },
  );

  it('explains how the minimum moves, with the X of the challenge', async () => {
    answer({ current_week: 3 });
    leaderboard([
      {
        type: 'elimination',
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
        entries: [runner('julie', 1, 6_000, { distance_meters: 6_000 })],
      },
    ]);
    renderAt(at);

    expect(
      await screen.findByText(
        "Pas d'élimination en semaine 1 : le premier minimum s'applique en semaine 2.",
      ),
    ).toBeInTheDocument();
    const ranking = await section('Classement complet');
    expect(within(ranking).queryByText(/cette semaine/)).not.toBeInTheDocument();
    expect(
      within(ranking).queryByText(/Objectif atteint|En cours|À risque/),
    ).not.toBeInTheDocument();
  });

  it('lists the eliminated apart with their week, still ranked in the other categories', async () => {
    answer({ current_week: 3 });
    const hugo = '10000000-0000-4000-8000-000000000999';
    leaderboard([
      { type: 'cumulative_time', entries: [entry('hugo', 1, 9_000, hugo)] },
      {
        type: 'elimination',
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
    expect(within(await section('Classement complet')).queryByText('hugo')).not.toBeInTheDocument();
    expect(within(await section('Podium')).queryByText('hugo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Temps cumulé' }));
    expect(within(await section('Classement complet')).getByText('hugo')).toBeInTheDocument();
  });

  it('keeps the at risk status of the user, whose row is highlighted', async () => {
    answer({ current_week: 3 });
    leaderboard([
      {
        type: 'elimination',
        entries: [
          {
            ...runner('marie_92', 1, 9_000, {
              status: 'at_risk',
              minimum_meters: 9_000,
              distance_meters: 3_000,
            }),
            user: { ...entry('marie_92', 1, 0).user, id: mockMe.id },
          },
        ],
      },
    ]);
    renderAt(at);

    const [mine] = within(await section('Classement complet')).getAllByRole('listitem');
    expect(mine).toHaveTextContent('Toi');
    expect(within(mine as HTMLElement).getByText('À risque')).toBeInTheDocument();
  });

  it('shows the eliminated user apart, named Toi, with the week', async () => {
    answer({ current_week: 3 });
    leaderboard([
      {
        type: 'elimination',
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
    expect(within(await section('Classement complet')).queryByText('Toi')).not.toBeInTheDocument();
  });

  it('shows neither status nor week end outside the weeks of the challenge', async () => {
    answer({ status: 'finished', current_week: null, week_ends_at: null });
    leaderboard([
      {
        type: 'elimination',
        entries: [runner('julie', 1, 30_000, { week_ends_at: null })],
      },
    ]);
    renderAt(at);

    const ranking = await section('Classement complet');
    expect(within(ranking).queryByText(/cette semaine/)).not.toBeInTheDocument();
    expect(within(await board()).queryByText(/Fin de la semaine/)).not.toBeInTheDocument();
    expect(within(await board()).queryByText(/Le minimum de la semaine/)).not.toBeInTheDocument();
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

  const withPoints = (entries: LeaderboardEntry[]): Leaderboard['categories'] => [
    { type: 'cumulative_time', entries: time },
    { type: 'points', entries },
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

  async function openPoints() {
    fireEvent.click(
      within(await screen.findByRole('group', { name: 'Catégorie du classement' })).getByRole(
        'button',
        { name: 'Grand prix' },
      ),
    );
  }

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
    renderAt(`/challenges/${id}`);

    await openPoints();

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

    const rows = within(await section('Classement complet')).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('43 pts + 12 pts provisoires');
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
    renderAt(`/challenges/${id}`);

    await openPoints();

    expect(within(await section('Podium')).getByText('55 pts')).toBeInTheDocument();
    expect(screen.queryByText(/provisoire/)).not.toBeInTheDocument();
  });

  it('keeps the provisional points and their rule after the end, until the last week locks', async () => {
    deviceIn(summary.timezone);
    answer({ ...pointsDetail, status: 'finished', current_week: null, week_ends_at: null });
    leaderboard(withPoints([scorer('julie', 1, 43, 10), scorer('marc', 2, 40, null)]));
    renderAt(`/challenges/${id}`);

    await openPoints();

    expect(within(await section('Podium')).getByText('+ 10 pts provisoires')).toBeInTheDocument();
    expect(screen.getByText(/^Les points d'une semaine sont acquis à 7 h/)).toBeInTheDocument();
  });
});
