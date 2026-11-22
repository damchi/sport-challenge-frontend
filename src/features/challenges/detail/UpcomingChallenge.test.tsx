import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { routes } from '../../../routes/routes';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;

// A challenge of Montréal starting on Sunday 29 November 2026, for 6 weeks.
const upcoming: ChallengeDetail = {
  ...mockChallengeDetail(summary),
  status: 'upcoming',
  my_role: 'participant',
  my_status: 'active',
  visibility: 'public',
  members_can_invite: true,
  can_join: false,
  starts_at: '2026-11-29T05:00:00Z',
  ends_at: '2027-01-10T05:00:00Z',
  registration_deadline: '2026-12-06T05:00:00Z',
  current_week: null,
  week_ends_at: null,
  week_count: 6,
  reference_sport: 'run',
  categories: [
    { type: 'cumulative_time', position: 1, params: {} },
    {
      type: 'cumulative_distance',
      position: 2,
      params: { factors: { run: 1, ride: 0.3, rowing: 0.5 } },
    },
    { type: 'elimination', position: 3, params: { sport: 'run', step_meters: 2000 } },
    { type: 'points', position: 4, params: { criteria: ['longest_duration'], podium: 10 } },
  ],
};

function answer(detail: Partial<ChallengeDetail> = {}) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () =>
      HttpResponse.json<ChallengeDetail>({ ...upcoming, ...detail }),
    ),
  );
}

function renderAt(path: string, deviceTimeZone = 'America/Montreal') {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone: deviceTimeZone };
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const title = () => screen.findByRole('heading', { level: 1, name: summary.title });

beforeEach(() => {
  // Only the clock is faked: the requests and the rendering keep their timers.
  vi.useFakeTimers({ toFake: ['Date'] });
  // 7 days, 1 h and 31 min before the start.
  vi.setSystemTime(new Date('2026-11-22T03:28:30Z'));
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  await i18n.changeLanguage('fr');
});

describe('UpcomingChallenge', () => {
  it('shows the status, the visibility and the participation above the title', async () => {
    answer();
    renderAt(`/challenges/${id}`);

    const header = (await title()).closest('header') as HTMLElement;
    for (const pill of ['À venir', 'Public', 'Tu participes']) {
      expect(within(header).getByText(pill)).toBeInTheDocument();
    }
    // No line of facts nor week before the start.
    expect(screen.queryByText(/Semaine \d sur/)).not.toBeInTheDocument();
  });

  it('counts down to the start, in the challenge time zone, with its weeks', async () => {
    answer();
    renderAt(`/challenges/${id}`);

    const banner = await screen.findByRole('region', { name: 'Départ dans' });
    expect(banner).toHaveTextContent(/7\s*jours\s*1\s*h\s*31\s*min/);
    expect(within(banner).getByText('Départ dimanche 29 novembre à 00 h')).toBeInTheDocument();
    expect(
      within(banner).getByText("6 semaines, jusqu'au 9 janv. 2027 inclus"),
    ).toBeInTheDocument();
    const weeks = within(banner).getByRole('list', { name: 'Semaines du défi' });
    expect(
      within(weeks)
        .getAllByRole('listitem')
        .map((week) => week.textContent),
    ).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
    expect(
      within(banner).getByText(
        "Seules les activités faites à partir du départ compteront. Les classements s'ouvriront à ce moment-là.",
      ),
    ).toBeInTheDocument();
  });

  it('names the challenge time zone at the start when the device is elsewhere', async () => {
    answer();
    renderAt(`/challenges/${id}`, 'Europe/Paris');

    expect(await screen.findByText(/^Départ dimanche 29 novembre à 00 h, \S/)).toBeInTheDocument();
  });

  it('reads the countdown whole to screen readers, and counts down', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-22T03:28:30Z'));
    answer();
    renderAt(`/challenges/${id}`);

    const banner = await screen.findByRole('region', { name: 'Départ dans' });
    expect(within(banner).getByText('7 jours, 1 heure et 31 minutes')).toHaveClass('sr-only');
    act(() => vi.advanceTimersByTime(60_000));
    expect(within(banner).getByText('7 jours, 1 heure et 30 minutes')).toBeInTheDocument();
  });

  it('says the challenge is starting and reads it again once the start is reached', async () => {
    vi.setSystemTime(new Date('2026-11-29T05:00:10Z'));
    let reads = 0;
    server.use(
      http.get('*/api/v1/challenges/:challengeId', () => {
        reads += 1;
        return HttpResponse.json<ChallengeDetail>(upcoming);
      }),
    );
    renderAt(`/challenges/${id}`);

    expect(await screen.findByText('Le défi commence…')).toBeInTheDocument();
    await vi.waitFor(() => expect(reads).toBeGreaterThan(1));
  });

  it('reads the challenge again at each tick while the server still says upcoming', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-29T05:00:10Z'));
    let reads = 0;
    server.use(
      http.get('*/api/v1/challenges/:challengeId', () => {
        reads += 1;
        return HttpResponse.json<ChallengeDetail>(upcoming);
      }),
    );
    renderAt(`/challenges/${id}`);

    expect(await screen.findByText('Le défi commence…')).toBeInTheDocument();
    await vi.waitFor(() => expect(reads).toBe(2));
    act(() => vi.advanceTimersByTime(30_000));
    await vi.waitFor(() => expect(reads).toBe(3));
  });

  it('does not load the leaderboard before the start', async () => {
    let leaderboards = 0;
    server.use(
      http.get('*/api/v1/challenges/:challengeId/leaderboard', () => {
        leaderboards += 1;
        return HttpResponse.json({ computed_at: '2026-11-18T15:00:00Z', categories: [] });
      }),
    );
    answer();
    renderAt(`/challenges/${id}`);

    expect(await screen.findByRole('region', { name: 'Détails' })).toBeInTheDocument();
    expect(leaderboards).toBe(0);
  });

  it('says one day in the singular', async () => {
    vi.setSystemTime(new Date('2026-11-28T03:00:00Z'));
    answer();
    renderAt(`/challenges/${id}`);

    expect(await screen.findByRole('region', { name: 'Départ dans' })).toHaveTextContent(
      /1\s*jour\s*2\s*h\s*0\s*min/,
    );
  });

  it.each(['', '/participants', '/activities'])(
    'shows no sections, whatever the address (%s)',
    async (section) => {
      answer();
      renderAt(`/challenges/${id}${section}`);

      expect(await screen.findByRole('heading', { name: 'Comment on gagne' })).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Sections du défi' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Où tu en es' })).not.toBeInTheDocument();
      expect(screen.queryByText('Règles des catégories')).not.toBeInTheDocument();
    },
  );

  it('lists the participants, without links to activities not done yet', async () => {
    answer();
    renderAt(`/challenges/${id}`);

    const participants = await screen.findByRole('region', { name: 'Participants' });
    expect(await within(participants).findByText('marie_92')).toBeInTheDocument();
    expect(within(participants).queryByRole('link')).not.toBeInTheDocument();
  });

  it('says how each category is won, in their order', async () => {
    answer();
    renderAt(`/challenges/${id}`);

    const howToWin = (await screen.findByRole('heading', { name: 'Comment on gagne' }))
      .parentElement as HTMLElement;
    expect(
      within(howToWin).getByText(
        '4 catégories, chacune avec son classement et son podium. Fixées à la création.',
      ),
    ).toBeInTheDocument();
    expect(
      within(howToWin)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Temps cumulé', 'Distance cumulée', 'Course avec élimination', 'Grand prix']);
    for (const wins of [
      'Le plus de temps cumulé, tous sports confondus, gagne',
      'Le plus de km équivalents gagne',
      'Le plus de km cumulés, parmi ceux encore en lice, gagne',
      'Le plus de points gagne',
    ]) {
      expect(within(howToWin).getByText(wins)).toBeInTheDocument();
    }
  });

  it('gives the frozen settings of the categories, the factors only in the details', async () => {
    answer();
    renderAt(`/challenges/${id}`);

    const howToWin = (await screen.findByRole('heading', { name: 'Comment on gagne' }))
      .parentElement as HTMLElement;
    expect(within(howToWin).getByText('Incrément X : 2 km')).toBeInTheDocument();
    expect(within(howToWin).getByText('Séance la plus longue en temps')).toBeInTheDocument();
    expect(
      within(howToWin).getByText(
        'Top 10 de chaque semaine et critère : 25, 18, 15, 12, 10, 8, 6, 4, 2 et 1 point',
      ),
    ).toBeInTheDocument();
    expect(within(howToWin).queryByText(/×0,3/)).not.toBeInTheDocument();
  });

  it('shows the details and the distance factors, the reference first', async () => {
    answer();
    renderAt(`/challenges/${id}`);

    const details = await screen.findByRole('region', { name: 'Détails' });
    const rows = within(details)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(rows).toEqual([
      ['Période', 'Du 29 nov. 2026 au 9 janv. 2027'],
      ['Durée', '6 semaines'],
      ['Fuseau', 'heure de l’Est nord-américain'],
      ['Visibilité', 'Public'],
      ['Invitations', 'Les participants peuvent inviter'],
      ['Sport de référence', 'Course'],
    ]);
    const factors = within(details)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(factors).toEqual(['Course ×1', 'Aviron ×0,5', 'Vélo ×0,3']);
  });

  it('lists no factors for a challenge without distance', async () => {
    answer({ categories: [{ type: 'cumulative_time', position: 1, params: {} }] });
    renderAt(`/challenges/${id}`);

    const details = await screen.findByRole('region', { name: 'Détails' });
    expect(within(details).queryByText('Coefficients de distance')).not.toBeInTheDocument();
  });

  it('reminds a creator what can still change, and opens the edition', async () => {
    answer({ my_role: 'creator' });
    renderAt(`/challenges/${id}`);

    const card = await screen.findByRole('region', { name: 'Tu as créé ce défi' });
    expect(
      within(card).getByText(
        'Tu peux changer le titre et la description à tout moment. Le reste est fixé à la création.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Modifier le défi' }));
    expect(await screen.findByRole('form', { name: 'Modifier le défi' })).toBeInTheDocument();
  });

  it('shows no creator card to a participant', async () => {
    answer();
    renderAt(`/challenges/${id}`);

    expect(await screen.findByRole('region', { name: 'Détails' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tu as créé ce défi' })).not.toBeInTheDocument();
  });
});
