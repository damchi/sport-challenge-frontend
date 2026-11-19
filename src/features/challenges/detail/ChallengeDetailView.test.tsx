import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { routes } from '../../../routes/routes';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';

const summary = mockChallenges[1];
if (!summary) throw new Error('No mock challenge');
const id = summary.id;

// An ongoing challenge of Montréal, in week 3, joined by the user.
const base: ChallengeDetail = {
  ...mockChallengeDetail(summary),
  status: 'ongoing',
  my_role: 'participant',
  my_status: 'active',
  can_join: false,
  current_week: 3,
  week_ends_at: '2026-11-23T05:00:00Z',
};

let requests = 0;

function answer(detail: Partial<ChallengeDetail>) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () => {
      requests += 1;
      return HttpResponse.json<ChallengeDetail>({ ...base, ...detail });
    }),
  );
}

/** Renders the app at `path`, on a device in the given time zone. */
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
}

const title = () => screen.findByRole('heading', { level: 1, name: summary.title });

beforeEach(() => {
  requests = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChallengeDetailView', () => {
  it('shows the header in the challenge time zone', async () => {
    answer({ visibility: 'private', description: 'Bougez !' });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    expect(screen.getByText('Du 2 nov. au 29 nov.')).toBeInTheDocument();
    expect(screen.getByText('Privé')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('Bougez !')).toBeInTheDocument();
    expect(screen.getByText('Semaine 3')).toBeInTheDocument();
    expect(screen.getByText('Fin de la semaine : lundi 23 novembre à 00 h')).toBeInTheDocument();
    expect(screen.queryByText(/Fuseau du défi/)).not.toBeInTheDocument();
  });

  it('names the challenge time zone when the device is elsewhere', async () => {
    answer({});
    renderAt(`/challenges/${id}`, 'Europe/Paris');

    expect(await title()).toBeInTheDocument();
    expect(screen.getByText(/^Fuseau du défi : /)).toBeInTheDocument();
    // Still the hour of Montréal, not of Paris, and said so.
    expect(
      screen.getByText(/^Fin de la semaine : lundi 23 novembre à 00 h, \S/),
    ).toBeInTheDocument();
  });

  it.each(['upcoming', 'finished'] as const)('shows no week when %s', async (status) => {
    answer({ status, current_week: null, week_ends_at: null });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    expect(screen.queryByText(/^Semaine/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fin de la semaine/)).not.toBeInTheDocument();
  });

  it.each([
    ['creator', 'active', ['Créateur']],
    ['participant', 'active', ['Participant']],
    ['abandoned', 'abandoned', ['A abandonné']],
    ['creator', 'abandoned', ['Créateur', 'A abandonné']],
  ] as const)('shows the role %s (%s)', async (role, status, pills) => {
    answer({ my_role: role, my_status: status });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    for (const pill of pills) expect(screen.getByText(pill)).toBeInTheDocument();
  });

  it('shows no role to an outsider', async () => {
    answer({ my_role: 'outsider', my_status: null });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    expect(screen.queryByText('Participant')).not.toBeInTheDocument();
    expect(screen.queryByText('Créateur')).not.toBeInTheDocument();
  });

  it('says the registration is open only when the server allows joining', async () => {
    answer({ my_role: 'outsider', my_status: null, can_join: true });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    expect(
      screen.getByText("Inscriptions ouvertes jusqu'au lundi 9 novembre à 00 h."),
    ).toBeInTheDocument();
  });

  it('follows can_join, not the dates', async () => {
    // Week 1 still running, but the server says no (already in, abandoned...).
    answer({ my_role: 'outsider', my_status: null, can_join: false, current_week: 1 });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    expect(screen.queryByText(/Inscriptions ouvertes/)).not.toBeInTheDocument();
  });

  it('shows the categories read only, with their frozen settings', async () => {
    answer({});
    renderAt(`/challenges/${id}`);

    const section = await screen.findByRole('region', { name: 'Catégories' });
    const items = within(section).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Temps cumulé');
    expect(within(section).getByText('Distance cumulée')).toBeInTheDocument();
    expect(within(section).getByText('Course ×1 (référence)')).toBeInTheDocument();
    expect(within(section).getByText('Vélo ×0,3')).toBeInTheDocument();
    expect(within(section).getByText('Incrément X : 2 km')).toBeInTheDocument();
    expect(within(section).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
  });

  it('links the three sections, the leaderboard first', async () => {
    answer({});
    renderAt(`/challenges/${id}/participants`);

    const nav = await screen.findByRole('navigation', { name: 'Sections du défi' });
    expect(within(nav).getByRole('link', { name: 'Classement' })).toHaveAttribute(
      'href',
      `/challenges/${id}`,
    );
    expect(within(nav).getByRole('link', { name: 'Participants' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Activités' })).toHaveAttribute(
      'href',
      `/challenges/${id}/activities`,
    );
  });

  it('shows the same page for a missing, deleted or hidden challenge', async () => {
    renderAt('/challenges/00000000-0000-4000-8000-999999999999');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Défi introuvable' }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ce défi n'existe pas ou tu n'y as pas accès.")).toBeInTheDocument();
  });

  it('shows the not found page when a refresh finds the challenge gone', async () => {
    answer({});
    renderAt(`/challenges/${id}`);
    expect(await title()).toBeInTheDocument();

    server.use(
      http.get('*/api/v1/challenges/:challengeId', () =>
        HttpResponse.json(
          { error: { code: 'challenge_not_found', message: 'Not found' } },
          { status: 404 },
        ),
      ),
    );
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Défi introuvable' }),
    ).toBeInTheDocument();
  });

  it('does not ask the API for an id that cannot be one', async () => {
    answer({});
    renderAt('/challenges/not-an-id');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Défi introuvable' }),
    ).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('offers a retry when the challenge cannot load', async () => {
    server.use(
      http.get('*/api/v1/challenges/:challengeId', () =>
        HttpResponse.json({ error: { code: 'internal_error', message: 'Boom' } }, { status: 500 }),
      ),
    );
    renderAt(`/challenges/${id}`);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    answer({});
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await title()).toBeInTheDocument();
  });
});
