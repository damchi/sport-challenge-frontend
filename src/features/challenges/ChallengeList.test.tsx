import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { mockChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ChallengeList } from './ChallengeList';

function challenge(index: number, overrides: Partial<ChallengeSummary> = {}): ChallengeSummary {
  const base = mockChallenges[index];
  if (!base) throw new Error(`No mock challenge ${index}`);
  return { ...base, ...overrides };
}

/** Answers the list and records the query of each request. */
function answerWith(
  pages: Record<string, { items: ChallengeSummary[]; next_cursor: string | null }>,
) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/challenges', ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      return HttpResponse.json(
        pages[query.get('cursor') ?? 'first'] ?? { items: [], next_cursor: null },
      );
    }),
  );
  return queries;
}

function renderList() {
  const router = createMemoryRouter([{ path: '/', element: <ChallengeList /> }]);
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('ChallengeList', () => {
  it('shows the public challenges first, with my participation', async () => {
    const queries = answerWith({
      first: {
        items: [
          challenge(0, { title: 'Défi 100 km', my_role: 'participant', status: 'ongoing' }),
          challenge(1, { title: 'Les ruelles', my_role: 'abandoned', status: 'finished' }),
          challenge(2, { title: 'Hors de moi', my_role: 'outsider', status: 'upcoming' }),
          challenge(3, { title: 'Le mien', my_role: 'creator', status: 'ongoing' }),
          challenge(4, {
            title: 'Quitté',
            my_role: 'creator',
            my_status: 'abandoned',
            status: 'ongoing',
          }),
        ],
        next_cursor: null,
      },
    });
    renderList();

    const card = (await screen.findByRole('heading', { name: 'Défi 100 km' })).closest('a');
    expect(card).toHaveAttribute('href', `/challenges/${mockChallenges[0]?.id}`);
    expect(within(card as HTMLElement).getByText('Participant')).toBeInTheDocument();
    const left = screen.getByRole('heading', { name: 'Quitté' }).closest('a');
    expect(within(left as HTMLElement).getByText('Créateur')).toBeInTheDocument();
    expect(within(left as HTMLElement).getByText('A abandonné')).toBeInTheDocument();
    const mine = (await screen.findByRole('heading', { name: 'Le mien' })).closest('a');
    expect(within(mine as HTMLElement).getByText('Créateur')).toBeInTheDocument();
    expect(within(mine as HTMLElement).queryByText('A abandonné')).toBeNull();
    const outsider = screen.getByRole('heading', { name: 'Hors de moi' }).closest('a');
    expect(
      within(outsider as HTMLElement).queryByText(/Créateur|Participant|abandonné/),
    ).toBeNull();
    // Unfiltered list: each card says its status.
    expect(within(card as HTMLElement).getByText('En cours')).toBeInTheDocument();
    expect(within(outsider as HTMLElement).getByText('À venir')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publics' })).toHaveAttribute('aria-pressed', 'true');
    expect(queries[0]?.get('scope')).toBe('public');
    expect(queries[0]?.has('status')).toBe(false);
  });

  it('switches to my challenges', async () => {
    const queries = answerWith({ first: { items: [challenge(0)], next_cursor: null } });
    const router = renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Mes défis' }));

    await waitFor(() => expect(queries.at(-1)?.get('scope')).toBe('mine'));
    expect(screen.getByRole('button', { name: 'Mes défis' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(router.state.location.search).toBe('?scope=mine');
  });

  it('filters by the status the server computes', async () => {
    const queries = answerWith({ first: { items: [challenge(0)], next_cursor: null } });
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'En cours' }));

    await waitFor(() => expect(queries.at(-1)?.get('status')).toBe('ongoing'));
    expect(screen.getByRole('button', { name: 'En cours' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'false');
    // Filtered list: the status is the filter, cards do not repeat it.
    const card = (await screen.findByRole('heading', { name: mockChallenges[0]?.title })).closest(
      'a',
    );
    expect(within(card as HTMLElement).queryByText('À venir')).toBeNull();
  });

  it('loads the next page with "Load more" until the last one', async () => {
    const queries = answerWith({
      first: { items: [challenge(0, { title: 'Page 1' })], next_cursor: 'c2' },
      c2: { items: [challenge(1, { title: 'Page 2' })], next_cursor: null },
    });
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Charger plus' }));

    expect(await screen.findByRole('heading', { name: 'Page 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page 1' })).toBeInTheDocument();
    expect(queries.at(-1)?.get('cursor')).toBe('c2');
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  it('ends the list with a tile to create a challenge', async () => {
    answerWith({
      first: {
        items: [challenge(0, { title: 'Quitté', my_status: 'abandoned' })],
        next_cursor: null,
      },
    });
    renderList();

    expect(await screen.findByRole('heading', { name: 'Quitté' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    const create = screen.getByRole('link', { name: 'Créer un défi' });
    expect(items).toHaveLength(2);
    expect(items.at(-1)).toContainElement(create);
    expect(create).toHaveAttribute('href', '/challenges/new');
  });

  it('suggests creating a challenge when the list is empty', async () => {
    answerWith({ first: { items: [], next_cursor: null } });
    renderList();

    expect(await screen.findByText(/Aucun défi public/)).toBeInTheDocument();
    // The empty state's button only, not the tile as well.
    const links = screen.getAllByRole('link', { name: 'Créer un défi' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/challenges/new');
  });

  it('keeps the loaded challenges when "Load more" fails, and retries', async () => {
    let more = 0;
    server.use(
      http.get('*/api/v1/challenges', ({ request }) => {
        if (!new URL(request.url).searchParams.has('cursor')) {
          return HttpResponse.json({
            items: [challenge(0, { title: 'Page 1' })],
            next_cursor: 'c2',
          });
        }
        more += 1;
        return more === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ items: [challenge(1, { title: 'Page 2' })], next_cursor: null });
      }),
    );
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Charger plus' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("La suite n'a pas pu être chargée.");
    expect(screen.getByRole('heading', { name: 'Page 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { name: 'Page 2' })).toBeInTheDocument();
  });

  it('offers all the challenges when a status filter finds none', async () => {
    answerWith({ first: { items: [], next_cursor: null } });
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Terminés' }));

    expect(await screen.findByText('Aucun défi ne correspond à ce statut.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voir tous les défis' }));

    expect(await screen.findByRole('button', { name: 'Tous' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows a translated error and loads again on retry', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/challenges', () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ items: [challenge(0, { title: 'Revenu' })], next_cursor: null });
      }),
    );
    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { name: 'Revenu' })).toBeInTheDocument();
  });

  it('announces the loading', () => {
    answerWith({ first: { items: [], next_cursor: null } });
    renderList();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
  });
});
