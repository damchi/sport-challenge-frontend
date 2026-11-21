import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail, Participant } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges, mockParticipants } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { routes } from '../../../routes/routes';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;
const path = `/challenges/${id}/participants`;

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

function participant(overrides: Partial<Participant>): Participant {
  return {
    user_id: '10000000-0000-4000-8000-000000000001',
    pseudo: 'sam',
    first_name: 'Sam',
    last_name: 'Roy',
    avatar: null,
    status: 'active',
    is_creator: false,
    joined_at: '2026-11-02T15:00:00Z',
    ...overrides,
  };
}

function listing(items: Participant[]) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/participants', () =>
      HttpResponse.json({ items, next_cursor: null }),
    ),
  );
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

const list = () => screen.findByRole('region', { name: 'Participants du défi' });

describe('ChallengeParticipants', () => {
  it('shows each participant with their status and day of registration', async () => {
    answer();
    listing([
      participant({}),
      participant({
        user_id: '10000000-0000-4000-8000-000000000002',
        pseudo: 'jean.luc',
        status: 'abandoned',
        // Still 1 November in Montréal.
        joined_at: '2026-11-02T03:00:00Z',
      }),
    ]);
    renderAt(path);

    const rows = within(await list()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const [active, abandoned] = rows as [HTMLElement, HTMLElement];
    expect(within(active).getByText('sam')).toBeInTheDocument();
    expect(within(active).getByText('Actif')).toBeInTheDocument();
    expect(within(active).getByText('Inscription : 2 nov.')).toBeInTheDocument();
    expect(within(abandoned).getByText('jean.luc')).toBeInTheDocument();
    expect(within(abandoned).getByText('A abandonné')).toBeInTheDocument();
    expect(within(abandoned).getByText('Inscription : 1 nov.')).toBeInTheDocument();
  });

  it('names a participant without any name with a neutral name', async () => {
    answer();
    listing([
      participant({ pseudo: null }),
      participant({
        user_id: '10000000-0000-4000-8000-000000000002',
        pseudo: null,
        first_name: null,
        last_name: null,
      }),
    ]);
    renderAt(path);

    const region = await list();
    expect(within(region).getByText('Sam Roy')).toBeInTheDocument();
    expect(within(region).getByText('Membre sans nom')).toBeInTheDocument();
  });

  it('loads the next page of participants', async () => {
    answer();
    renderAt(path);

    const region = await list();
    expect(within(region).getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(await within(region).findByText(mockParticipants[24]?.pseudo ?? '')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(mockParticipants.length);
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  it('opens the activities of a participant for a participant of the challenge', async () => {
    answer();
    listing([participant({})]);
    const router = renderAt(path);

    fireEvent.click(await screen.findByRole('link', { name: /sam/ }));
    // Once the code of the participant's page has loaded.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/challenges/${id}/participants/10000000-0000-4000-8000-000000000001`,
      ),
    );
    expect(screen.getByRole('link', { name: 'Participants' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not link to the activities for a visitor of a public challenge', async () => {
    answer({ my_role: 'outsider', my_status: null });
    listing([participant({})]);
    renderAt(path);

    expect(within(await list()).getByText('sam')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sam/ })).not.toBeInTheDocument();
  });

  it('says when no one has joined yet', async () => {
    answer();
    listing([]);
    renderAt(path);

    expect(await screen.findByText("Personne n'a encore rejoint ce défi.")).toBeInTheDocument();
  });

  it('offers a retry when the participants cannot load', async () => {
    answer();
    server.use(
      http.get('*/api/v1/challenges/:challengeId/participants', () =>
        HttpResponse.json({ error: { code: 'internal_error', message: 'Boom' } }, { status: 500 }),
      ),
    );
    renderAt(path);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    listing([participant({})]);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(within(await list()).getByText('sam')).toBeInTheDocument();
  });
});
