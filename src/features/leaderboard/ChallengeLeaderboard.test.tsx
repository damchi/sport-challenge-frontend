import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail, Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';
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

const threeCategories: Leaderboard['categories'] = [
  { type: 'cumulative_time', entries: time },
  { type: 'cumulative_distance', entries: [entry('nina', 1, 12_500)] },
  { type: 'run_elimination', entries: [entry('hugo', 1, 8_000)] },
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

  it('opens the activities of a participant for a participant of the challenge', async () => {
    answer();
    leaderboard(threeCategories);
    const router = renderAt(`/challenges/${id}?category=run_elimination`);

    fireEvent.click(
      within(await section('Classement complet')).getByRole('link', { name: /hugo/ }),
    );
    expect(router.state.location.pathname).toMatch(
      new RegExp(`^/challenges/${id}/participants/[0-9a-f-]+$`),
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
      { type: 'run_elimination', entries: [] },
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
