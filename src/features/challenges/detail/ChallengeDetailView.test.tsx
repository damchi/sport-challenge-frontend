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
    expect(screen.getByRole('button', { name: 'Rejoindre le défi' })).toBeInTheDocument();
  });

  it.each([
    ['participant', 'active', 'Tu participes à ce défi.'],
    ['creator', 'active', 'Tu participes à ce défi.'],
    [
      'abandoned',
      'abandoned',
      "Tu as abandonné ce défi : c'est définitif, tu ne peux plus le rejoindre.",
    ],
    [
      'creator',
      'abandoned',
      "Tu as abandonné ce défi : c'est définitif, tu ne peux plus le rejoindre.",
    ],
    [
      'outsider',
      null,
      'Les inscriptions sont closes depuis la fin de la semaine 1, le lundi 9 novembre à 00 h.',
    ],
    [
      'invited',
      null,
      'Les inscriptions sont closes depuis la fin de la semaine 1, le lundi 9 novembre à 00 h.',
    ],
  ] as const)('explains why a %s (%s) cannot join', async (role, status, reason) => {
    // can_join and my_status decide: the page compares no date.
    answer({ my_role: role, my_status: status, can_join: false });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.queryByText(/Inscriptions ouvertes/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejoindre le défi' })).not.toBeInTheDocument();
  });

  describe('joining', () => {
    let joins = 0;

    beforeEach(() => {
      joins = 0;
      answer({ my_role: 'outsider', my_status: null, can_join: true });
    });

    function joinAnswers(response: () => Response) {
      server.use(
        http.post('*/api/v1/challenges/:challengeId/join', () => {
          joins += 1;
          return response();
        }),
      );
    }

    // An arrow, not a hoisted function, so that `summary` stays narrowed.
    const openConfirmation = async () => {
      renderAt(`/challenges/${id}`);
      fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre le défi' }));
      return screen.getByRole('dialog', { name: `Rejoindre « ${summary.title} » ?` });
    };

    it('asks for a confirmation that says the activities will be visible', async () => {
      joinAnswers(() => HttpResponse.json({ ...base }, { status: 201 }));
      const dialog = await openConfirmation();

      expect(dialog).toHaveAccessibleDescription(
        'Tes activités (date, sport, durée, distance) seront visibles par les autres participants du défi.',
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(joins).toBe(0);
    });

    it('joins on confirmation and reloads the challenge, its lists and leaderboards', async () => {
      const joined: ChallengeDetail = {
        ...base,
        my_role: 'participant',
        my_status: 'active',
        can_join: false,
      };
      joinAnswers(() => HttpResponse.json(joined, { status: 201 }));
      const dialog = await openConfirmation();
      const before = requests;
      answer(joined);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Rejoindre' }));

      const outcome = await screen.findByRole('status');
      expect(outcome).toHaveTextContent('Tu participes à ce défi.');
      // The button is gone: the focus moves to the outcome.
      expect(outcome).toHaveFocus();
      expect(screen.getByText('Participant')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rejoindre le défi' })).not.toBeInTheDocument();
      expect(joins).toBe(1);
      // Every challenge query is invalidated: the page's, so the lists and
      // the leaderboards (same root key) reload too.
      await vi.waitFor(() => expect(requests).toBeGreaterThan(before));
    });

    it('keeps the button focusable but inert while the join is sent', async () => {
      let release: () => void = () => undefined;
      const sent = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.post('*/api/v1/challenges/:challengeId/join', async () => {
          joins += 1;
          await sent;
          return HttpResponse.json({ ...base }, { status: 201 });
        }),
      );
      const dialog = await openConfirmation();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Rejoindre' }));

      const busy = await screen.findByRole('button', { name: 'Inscription…' });
      expect(busy).toHaveAttribute('aria-disabled', 'true');
      expect(busy).toBeEnabled();
      fireEvent.click(busy);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(joins).toBe(1);
      answer({});
      release();
      expect(await screen.findByText('Tu participes à ce défi.')).toBeInTheDocument();
    });

    it.each([
      [409, 'already_participant', 'Tu participes déjà à ce défi.'],
      [
        422,
        'registration_closed',
        'Les inscriptions à ce défi sont closes depuis la fin de la semaine 1.',
      ],
      [422, 'participation_abandoned', 'Tu as abandonné ce défi : tu ne peux plus le rejoindre.'],
      [422, 'profile_incomplete', "Indique d'abord ton prénom et ton nom dans ton profil."],
    ] as const)('translates a refusal %i %s', async (status, code, message) => {
      joinAnswers(() => HttpResponse.json({ error: { code, message: 'Raw' } }, { status }));
      const dialog = await openConfirmation();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Rejoindre' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByText('Raw')).not.toBeInTheDocument();
    });

    it('shows why once the reloaded challenge refuses joining', async () => {
      joinAnswers(() =>
        HttpResponse.json(
          { error: { code: 'registration_closed', message: 'Closed' } },
          { status: 422 },
        ),
      );
      const dialog = await openConfirmation();
      answer({ my_role: 'outsider', my_status: null, can_join: false });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Rejoindre' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Les inscriptions sont closes depuis la fin de la semaine 1, le lundi 9 novembre à 00 h.',
      );
      expect(screen.queryByRole('button', { name: 'Rejoindre le défi' })).not.toBeInTheDocument();
    });
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
