import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import type { components } from '../../api/generated/schema';
import { mockChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ChallengeList } from './ChallengeList';

type ChallengePage = components['schemas']['ChallengePage'];
type Counts = ChallengePage['counts'];
type Status = ChallengeSummary['status'];

function challenge(index: number, overrides: Partial<ChallengeSummary> = {}): ChallengeSummary {
  const base = mockChallenges[index];
  if (!base) throw new Error(`No mock challenge ${index}`);
  return { ...base, my_week: null, best_result: null, ...overrides };
}

const COUNTS: Counts = { ongoing: 2, upcoming: 1, finished: 1 };

/**
 * Answers the list by status (`<status>` for the first page, `<status>:<cursor>`
 * for the next ones), with the same counts on every page, and records the
 * query of each request.
 */
function answerWith(
  pages: Partial<Record<string, { items: ChallengeSummary[]; next_cursor: string | null }>>,
  counts: Counts = COUNTS,
) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/challenges', ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      const cursor = query.get('cursor');
      const key = `${query.get('status') ?? 'all'}${cursor ? `:${cursor}` : ''}`;
      const page = pages[key] ?? { items: [], next_cursor: null };
      return HttpResponse.json<ChallengePage>({ ...page, counts });
    }),
  );
  return queries;
}

function onePage(status: Status, ...titles: string[]) {
  return {
    items: titles.map((title, index) => challenge(index, { title, status })),
    next_cursor: null,
  };
}

function renderList(path = '/') {
  const router = createMemoryRouter([{ path: '/', element: <ChallengeList /> }], {
    initialEntries: [path],
  });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const chip = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('ChallengeList', () => {
  it('shows my challenges first, one section per status, each status counted', async () => {
    const queries = answerWith({
      ongoing: onePage('ongoing', 'Défi d’automne', 'Les ruelles'),
      upcoming: onePage('upcoming', 'Challenge des braves'),
      finished: onePage('finished', 'Défi d’octobre'),
    });
    renderList();

    const ongoing = await screen.findByRole('region', { name: 'En cours' });
    expect(within(ongoing).getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(
      await within(screen.getByRole('region', { name: 'À venir' })).findByRole('heading', {
        name: 'Challenge des braves',
      }),
    ).toBeInTheDocument();
    expect(
      await within(screen.getByRole('region', { name: 'Terminés' })).findByRole('heading', {
        name: 'Défi d’octobre',
      }),
    ).toBeInTheDocument();
    // Sections in the mockup's order.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'En cours',
      'À venir',
      'Terminés',
    ]);
    expect(screen.getByRole('button', { name: 'Mes défis' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(chip('Tous')).toHaveTextContent('Tous 4 défis');
    expect(chip('Tous')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('En cours')).toHaveAccessibleName(/^En cours 2\s*défis$/);
    expect(chip('À venir')).toHaveAccessibleName(/^À venir 1\s*défi$/);
    expect(chip('En cours')).toHaveTextContent('En cours 2 défis');
    expect(chip('À venir')).toHaveTextContent('À venir 1 défi');
    expect(chip('Terminés')).toHaveTextContent('Terminés 1 défi');
    // One query per status, all for my challenges.
    expect(new Set(queries.map((query) => query.get('status')))).toEqual(
      new Set(['ongoing', 'upcoming', 'finished']),
    );
    expect(queries.every((query) => query.get('scope') === 'mine')).toBe(true);
  });

  it('leaves out the sections without a challenge', async () => {
    const queries = answerWith(
      { ongoing: onePage('ongoing', 'Seul') },
      { ongoing: 1, upcoming: 0, finished: 0 },
    );
    renderList();

    expect(await screen.findByRole('heading', { name: 'Seul' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'À venir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Terminés' })).not.toBeInTheDocument();
    // No request for the statuses without a challenge.
    expect(new Set(queries.map((query) => query.get('status')))).toEqual(new Set(['ongoing']));
  });

  it('leaves out a counted section that comes back empty', async () => {
    // The counts say one upcoming challenge, but it is gone when its page is read.
    answerWith({ ongoing: onePage('ongoing', 'Seul') }, { ongoing: 1, upcoming: 1, finished: 0 });
    renderList();

    expect(await screen.findByRole('heading', { name: 'Seul' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'À venir' })).not.toBeInTheDocument();
  });

  it('switches to the public challenges', async () => {
    const queries = answerWith({ ongoing: onePage('ongoing', 'Public') });
    const router = renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Publics' }));

    await waitFor(() => expect(queries.at(-1)?.get('scope')).toBe('public'));
    expect(screen.getByRole('button', { name: 'Publics' })).toHaveAttribute('aria-pressed', 'true');
    expect(router.state.location.search).toBe('?scope=public');
  });

  it('filters by the status the server computes, keeping every count', async () => {
    const queries = answerWith({ ongoing: onePage('ongoing', 'Défi d’automne') });
    const router = renderList();

    fireEvent.click(await screen.findByRole('button', { name: /^En cours/ }));

    expect(router.state.location.search).toBe('?status=ongoing');
    expect(chip('En cours')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Tous')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('Tous')).toHaveTextContent('Tous 4 défis');
    expect(await screen.findByRole('heading', { name: 'Défi d’automne' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'À venir' })).not.toBeInTheDocument();
    expect(queries.at(-1)?.get('status')).toBe('ongoing');
  });

  it('loads the next page of a section with "Load more" until the last one', async () => {
    const queries = answerWith({
      ongoing: { items: [challenge(0, { title: 'Page 1', status: 'ongoing' })], next_cursor: 'c2' },
      'ongoing:c2': {
        items: [challenge(1, { title: 'Page 2', status: 'ongoing' })],
        next_cursor: null,
      },
    });
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Charger plus' }));

    const section = screen.getByRole('region', { name: 'En cours' });
    expect(await within(section).findByRole('heading', { name: 'Page 2' })).toBeInTheDocument();
    expect(within(section).getByRole('heading', { name: 'Page 1' })).toBeInTheDocument();
    expect(queries.at(-1)?.get('cursor')).toBe('c2');
    expect(queries.at(-1)?.get('status')).toBe('ongoing');
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  it('keeps the loaded challenges when "Load more" fails, and retries', async () => {
    let more = 0;
    server.use(
      http.get('*/api/v1/challenges', ({ request }) => {
        const query = new URL(request.url).searchParams;
        const counts: Counts = { ongoing: 2, upcoming: 0, finished: 0 };
        if (!query.has('cursor')) {
          return HttpResponse.json<ChallengePage>({
            items: [challenge(0, { title: 'Page 1', status: 'ongoing' })],
            next_cursor: 'c2',
            counts,
          });
        }
        more += 1;
        return more === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json<ChallengePage>({
              items: [challenge(1, { title: 'Page 2', status: 'ongoing' })],
              next_cursor: null,
              counts,
            });
      }),
    );
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Charger plus' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("La suite n'a pas pu être chargée.");
    expect(screen.getByRole('heading', { name: 'Page 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { name: 'Page 2' })).toBeInTheDocument();
  });

  it('suggests creating a challenge when I have none', async () => {
    answerWith({}, { ongoing: 0, upcoming: 0, finished: 0 });
    renderList();

    expect(await screen.findByText(/Tu ne participes encore à aucun défi/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un défi' })).toHaveAttribute(
      'href',
      '/challenges/new',
    );
    expect(screen.queryByRole('region', { name: 'En cours' })).not.toBeInTheDocument();
  });

  it('offers all the challenges when a status filter finds none', async () => {
    answerWith({}, { ongoing: 1, upcoming: 0, finished: 0 });
    renderList('/?status=finished');

    expect(await screen.findByText('Aucun défi ne correspond à ce statut.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voir tous les défis' }));

    await waitFor(() => expect(chip('Tous')).toHaveAttribute('aria-pressed', 'true'));
  });

  it('shows a translated error and loads again on retry', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/challenges', () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json<ChallengePage>({
              items: [challenge(0, { title: 'Revenu', status: 'ongoing' })],
              next_cursor: null,
              counts: { ongoing: 1, upcoming: 0, finished: 0 },
            });
      }),
    );
    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { name: 'Revenu' })).toBeInTheDocument();
  });

  it('shows the error of one section, with a retry, and the others', async () => {
    let upcomingCalls = 0;
    server.use(
      http.get('*/api/v1/challenges', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        if (status === 'upcoming' && (upcomingCalls += 1) === 1) {
          return new HttpResponse(null, { status: 503 });
        }
        return HttpResponse.json<ChallengePage>({
          items: [challenge(0, { title: `Défi ${status}`, status: status as Status })],
          next_cursor: null,
          counts: { ongoing: 1, upcoming: 1, finished: 0 },
        });
      }),
    );
    renderList();

    const upcoming = await screen.findByRole('region', { name: 'À venir' });
    expect(await within(upcoming).findByRole('alert')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Défi ongoing' })).toBeInTheDocument();
    fireEvent.click(within(upcoming).getByRole('button', { name: 'Réessayer' }));

    expect(await within(upcoming).findByRole('heading', { name: 'Défi upcoming' })).toBeVisible();
  });

  it('announces the loading', () => {
    answerWith({});
    renderList();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
  });
});
