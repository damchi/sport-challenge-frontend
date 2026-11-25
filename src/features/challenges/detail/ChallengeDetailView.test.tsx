import { focusManager } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges, mockMe } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { routes } from '../../../routes/routes';
import { AppProviders } from '../../../test/AppProviders';
import { ChallengeDetailView } from './ChallengeDetailView';
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

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Unmount first: a mounted page would apply its profile language again.
  cleanup();
  await i18n.changeLanguage('fr');
});

describe('ChallengeDetailView', () => {
  it('keeps its header and shows the loading state while the code of a section loads', async () => {
    answer({});
    let loaded: (section: { Component: () => ReactNode }) => void = () => undefined;
    const router = createMemoryRouter(
      [
        {
          path: '/challenges/:challengeId',
          element: <ChallengeDetailView />,
          children: [
            { index: true, element: <p>first section</p> },
            { path: 'participants', lazy: () => new Promise((resolve) => (loaded = resolve)) },
          ],
        },
      ],
      { initialEntries: [`/challenges/${id}`] },
    );
    render(
      <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByText('first section')).toBeInTheDocument();

    act(() => void router.navigate(`/challenges/${id}/participants`));
    expect(await screen.findByRole('status', { busy: true })).toHaveTextContent(/^Chargement…$/);
    expect(screen.queryByText('first section')).not.toBeInTheDocument();
    expect(await title()).toBeInTheDocument();

    await act(async () => loaded({ Component: () => <p>participants section</p> }));
    expect(await screen.findByText('participants section')).toBeInTheDocument();
  });

  it('shows the header: facts, week of the weeks, description, and the week in a banner', async () => {
    answer({ description: 'Bougez !', participant_count: 8 });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    // The server's numbers: participants, categories, current and total weeks.
    expect(screen.getByText('8 participants')).toBeInTheDocument();
    expect(screen.getByText('3 catégories')).toBeInTheDocument();
    expect(screen.getByText('Semaine 3 sur 4')).toBeInTheDocument();
    expect(screen.getByText('Tu participes')).toBeInTheDocument();
    expect(screen.getByText('Bougez !')).toBeInTheDocument();
    // In the challenge time zone, the device's here: not named.
    expect(screen.getByText('Semaine 3 · se termine lundi 23 novembre à 00 h')).toBeInTheDocument();
    expect(await screen.findByText('Classements mis à jour : 18 nov., 10:00')).toBeInTheDocument();
    // Gone from the header: the status and role pills.
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
    expect(screen.queryByText('Participant')).not.toBeInTheDocument();
  });

  it('names the challenge time zone in the banner when the device is elsewhere', async () => {
    answer({});
    renderAt(`/challenges/${id}`, 'Europe/Paris');

    expect(await title()).toBeInTheDocument();
    // Still the hour of Montréal, not of Paris, and said so.
    expect(
      screen.getByText(/^Semaine 3 · se termine lundi 23 novembre à 00 h, \S/),
    ).toBeInTheDocument();
  });

  it('says the results are final in place of the banner once finished', async () => {
    answer({ status: 'finished', current_week: null, week_ends_at: null });
    renderAt(`/challenges/${id}`);

    expect(await screen.findByText(/^Résultats définitifs/)).toBeInTheDocument();
    expect(screen.queryByText(/se termine/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Semaine \d sur/)).not.toBeInTheDocument();
  });

  it('names a single category in the singular', async () => {
    answer({ categories: [{ type: 'cumulative_time', position: 1, params: {} }] });
    renderAt(`/challenges/${id}`);

    expect(await screen.findByText('1 catégorie')).toBeInTheDocument();
  });

  it.each([
    ['participant', 'active', true],
    ['creator', 'active', true],
    ['abandoned', 'abandoned', false],
    ['creator', 'abandoned', false],
    ['outsider', null, false],
  ] as const)('shows « Tu participes » to a %s (%s): %s', async (role, status, shown) => {
    answer({ my_role: role, my_status: status });
    renderAt(`/challenges/${id}`);

    expect(await title()).toBeInTheDocument();
    if (shown) expect(screen.getByText('Tu participes')).toBeInTheDocument();
    else expect(screen.queryByText('Tu participes')).not.toBeInTheDocument();
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
      // A section without statuses of its own (the leaderboard and the
      // participants show theirs), so the outcome is the only one.
      renderAt(`/challenges/${id}/activities`);
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

      // Found by its text: the abandon's status, empty, is on the page too.
      const outcome = await screen.findByText('Tu participes à ce défi.');
      await vi.waitFor(() => expect(outcome).toHaveAttribute('role', 'status'));
      // The button is gone: the focus moves to the outcome.
      expect(outcome).toHaveFocus();
      expect(screen.getByText('Tu participes')).toBeInTheDocument();
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

  describe('abandoning', () => {
    let abandons = 0;
    const abandoned: ChallengeDetail = {
      ...base,
      my_role: 'abandoned',
      my_status: 'abandoned',
      can_join: false,
    };

    beforeEach(() => {
      abandons = 0;
      answer({});
    });

    function abandonAnswers(response: () => Response | Promise<Response>) {
      server.use(
        http.post('*/api/v1/challenges/:challengeId/abandon', () => {
          abandons += 1;
          return response();
        }),
      );
    }

    // An arrow, not a hoisted function, so that `summary` stays narrowed.
    const openConfirmation = async (render = true) => {
      // A section without statuses of its own (the leaderboard and the
      // participants show theirs), so the outcome is the only one.
      if (render) renderAt(`/challenges/${id}/activities`);
      fireEvent.click(await screen.findByRole('button', { name: "Plus d'actions" }));
      fireEvent.click(screen.getByRole('button', { name: 'Abandonner le défi' }));
      return screen.getByRole('dialog', { name: `Abandonner « ${summary.title} » ?` });
    };

    it('asks for a confirmation that says it is final and off the podium', async () => {
      abandonAnswers(() => HttpResponse.json(abandoned));
      const dialog = await openConfirmation();

      expect(dialog).toHaveAccessibleDescription(
        "C'est définitif : tu es éliminé de toutes les catégories et tu apparais « A abandonné » dans les classements, hors podium. Tu ne pourras plus rejoindre ce défi.",
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(abandons).toBe(0);
      // The focus is back on the menu's button.
      expect(screen.getByRole('button', { name: "Plus d'actions" })).toHaveFocus();
    });

    it('abandons on confirmation and reloads the challenge, its lists and leaderboards', async () => {
      abandonAnswers(() => HttpResponse.json(abandoned));
      const before = requests;
      const dialog = await openConfirmation();
      answer(abandoned);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Abandonner' }));

      // The reloaded challenge may say it first: it becomes the announced
      // outcome once the abandon has answered.
      const outcome = await screen.findByText(
        "Tu as abandonné ce défi : c'est définitif, tu ne peux plus le rejoindre.",
      );
      await vi.waitFor(() => expect(outcome).toHaveAttribute('role', 'status'));
      // Sent: no longer said to be on its way.
      expect(screen.queryByText('Abandon en cours…')).not.toBeInTheDocument();
      // The button is gone: the focus moves to the outcome.
      expect(outcome).toHaveFocus();
      expect(screen.queryByText('Tu participes')).not.toBeInTheDocument();
      // A participant has no other action: the menu is gone.
      expect(screen.queryByRole('button', { name: "Plus d'actions" })).not.toBeInTheDocument();
      expect(abandons).toBe(1);
      // The lists and the leaderboards (same root key) reload too.
      await vi.waitFor(() => expect(requests).toBeGreaterThan(before));
    });

    it('sends the abandon once when clicked again while it is sent', async () => {
      let release: () => void = () => undefined;
      const sent = new Promise<void>((resolve) => {
        release = resolve;
      });
      abandonAnswers(async () => {
        await sent;
        return HttpResponse.json(abandoned);
      });
      const dialog = await openConfirmation();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Abandonner' }));
      await vi.waitFor(() => expect(abandons).toBe(1));
      // Said while it is sent.
      expect(await screen.findByText('Abandon en cours…')).toHaveAttribute('role', 'status');

      // Asked again from the menu while it is sent: nothing more is sent.
      const again = await openConfirmation(false);
      fireEvent.click(within(again).getByRole('button', { name: 'Abandonner' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(abandons).toBe(1);
      answer(abandoned);
      release();
      expect(
        await screen.findByText(
          "Tu as abandonné ce défi : c'est définitif, tu ne peux plus le rejoindre.",
        ),
      ).toBeInTheDocument();
    });

    it('says the challenge is over when the server refuses', async () => {
      abandonAnswers(() =>
        HttpResponse.json({ error: { code: 'challenge_ended', message: 'Raw' } }, { status: 422 }),
      );
      const dialog = await openConfirmation();
      answer({ status: 'finished', current_week: null, week_ends_at: null });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Abandonner' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Ce défi est terminé.');
      // The dialog is closed: the focus moves to the message; the reloaded
      // challenge is finished, the menu is gone.
      expect(screen.getByRole('alert')).toHaveFocus();
      await vi.waitFor(() =>
        expect(screen.queryByRole('button', { name: "Plus d'actions" })).not.toBeInTheDocument(),
      );
      expect(screen.queryByText('Raw')).not.toBeInTheDocument();
    });

    it('keeps the creator role of a creator who abandons', async () => {
      const creator = { my_role: 'creator', my_status: 'active' } as const;
      answer(creator);
      abandonAnswers(() => HttpResponse.json({ ...base, ...creator, my_status: 'abandoned' }));
      const dialog = await openConfirmation();
      answer({ ...creator, my_status: 'abandoned' });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Abandonner' }));

      // A creator's page has a second status line, the edit form's: the
      // outcome is found by its text, then becomes a status once answered.
      await vi.waitFor(() =>
        expect(
          screen.getByText(
            "Tu as abandonné ce défi : c'est définitif, tu ne peux plus le rejoindre.",
          ),
        ).toHaveAttribute('role', 'status'),
      );
      // Still a creator: the menu keeps editing and deleting, not abandoning.
      fireEvent.click(screen.getByRole('button', { name: "Plus d'actions" }));
      expect(screen.getByRole('button', { name: 'Supprimer le défi' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Abandonner le défi' })).not.toBeInTheDocument();
    });

    it('keeps the button to try again after a network error', async () => {
      abandonAnswers(() => HttpResponse.error());
      const dialog = await openConfirmation();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Abandonner' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Connexion impossible.');
      fireEvent.click(screen.getByRole('button', { name: "Plus d'actions" }));
      expect(screen.getByRole('button', { name: 'Abandonner le défi' })).toBeInTheDocument();
    });

    it.each([
      ['a finished challenge', { status: 'finished' }],
      ['an abandoned participation', { my_role: 'abandoned', my_status: 'abandoned' }],
      ['a creator who does not take part', { my_role: 'creator', my_status: null }],
    ] as const)('offers no abandon for %s', async (_, detail) => {
      answer(detail);
      renderAt(`/challenges/${id}`);

      expect(await title()).toBeInTheDocument();
      const menu = screen.queryByRole('button', { name: "Plus d'actions" });
      if (menu) fireEvent.click(menu);
      expect(screen.queryByRole('button', { name: 'Abandonner le défi' })).not.toBeInTheDocument();
    });
  });

  /** « Comment on gagne » of the page. */
  async function howToWin(name = 'Comment on gagne') {
    return (await screen.findByRole('heading', { name })).parentElement as HTMLElement;
  }

  /** The names of the categories, in their order. */
  const categoryNames = (section: HTMLElement) =>
    within(section)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);

  /** The rows of « Détails », as [term, value]. */
  const detailRows = (section: HTMLElement) =>
    within(section)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

  it('says how each category is won, with its frozen settings, below the sections', async () => {
    answer({});
    renderAt(`/challenges/${id}`);

    const section = await howToWin();
    expect(categoryNames(section)).toEqual([
      'Temps cumulé',
      'Distance cumulée',
      'Course avec élimination',
    ]);
    expect(
      within(section).getByText('Le plus de temps cumulé, tous sports confondus, gagne'),
    ).toBeInTheDocument();
    expect(within(section).getByText('Incrément X : 2 km')).toBeInTheDocument();
    // Listed once, in the details.
    expect(within(section).queryByText(/×0,3/)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sections du défi' })).toBeInTheDocument();
  });

  it('shows the details of an ongoing challenge, read only, with its factors', async () => {
    answer({ visibility: 'private' });
    renderAt(`/challenges/${id}`);

    const details = await screen.findByRole('region', { name: 'Détails' });
    expect(detailRows(details)).toEqual([
      ['Période', 'Du 2 nov. au 29 nov.'],
      ['Durée', '4 semaines'],
      ['Fuseau', 'heure de l’Est nord-américain'],
      ['Visibilité', 'Privé'],
      ['Invitations', 'Les participants peuvent inviter'],
      ['Sport de référence', 'Course'],
    ]);
    expect(
      within(details)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Course ×1', 'Aviron ×0,5', 'Marche ×1', 'Vélo ×0,3']);
    expect(within(details).getByText('Référence : course (×1).')).toBeInTheDocument();
    expect(within(details).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows only the cumulative time of a challenge that has no other category', async () => {
    answer({ categories: [{ type: 'cumulative_time', position: 1, params: {} }] });
    renderAt(`/challenges/${id}`);

    const section = await howToWin();
    expect(categoryNames(section)).toEqual(['Temps cumulé']);
    expect(
      within(section).getByText(
        '1 catégorie, avec son classement et son podium. Fixée à la création.',
      ),
    ).toBeInTheDocument();
    expect(
      within(await screen.findByRole('region', { name: 'Détails' })).queryByText(
        'Coefficients de distance',
      ),
    ).not.toBeInTheDocument();
  });

  it('shows two categories in their order, without the missing one', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        { type: 'elimination', position: 3, params: { sport: 'run', step_meters: 3000 } },
      ],
    });
    renderAt(`/challenges/${id}`);

    const section = await howToWin();
    expect(categoryNames(section)).toEqual(['Temps cumulé', 'Course avec élimination']);
    expect(within(section).getByText('Incrément X : 3 km')).toBeInTheDocument();
  });

  it('names the reference sport of a cycling challenge, in the elimination and the factors', async () => {
    answer({
      reference_sport: 'ride',
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        {
          type: 'cumulative_distance',
          position: 2,
          params: { factors: { ride: 1, run: 1, rowing: 1 } },
        },
        { type: 'elimination', position: 3, params: { sport: 'ride', step_meters: 10_000 } },
      ],
    });
    renderAt(`/challenges/${id}`);

    const section = await howToWin();
    expect(within(section).getByText('Vélo avec élimination')).toBeInTheDocument();
    expect(within(section).getByText(/^Vélo seulement, en distance réelle/)).toBeInTheDocument();
    const details = await screen.findByRole('region', { name: 'Détails' });
    expect(within(details).getByText('Référence : vélo (×1).')).toBeInTheDocument();
    expect(within(details).getAllByRole('listitem')[0]).toHaveTextContent('Vélo ×1');
  });

  it('shows the criteria, the scale and the minimum of the points, and their factors', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        {
          type: 'points',
          position: 4,
          params: {
            criteria: ['longest_distance', 'session_count'],
            podium: 10,
            min_session_seconds: 1200,
            factors: { run: 1, ride: 0.3 },
          },
        },
      ],
    });
    renderAt(`/challenges/${id}`);

    const section = await howToWin();
    for (const text of [
      'Séance la plus longue en distance équivalente',
      'Nombre de séances',
      'Top 10 de chaque semaine et critère : 25, 18, 15, 12, 10, 8, 6, 4, 2 et 1 point',
      'Une séance compte à partir de 20 min',
    ]) {
      expect(within(section).getByText(text)).toBeInTheDocument();
    }
    // The factors of the points, without a total distance: in the details.
    const details = await screen.findByRole('region', { name: 'Détails' });
    expect(
      within(details)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Course ×1', 'Vélo ×0,3']);
  });

  it('explains the elevation gain of the week among the criteria of the points', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        {
          type: 'points',
          position: 4,
          params: { criteria: ['weekly_elevation'], podium: 5, min_session_seconds: 1200 },
        },
      ],
    });
    renderAt(`/challenges/${id}`);

    const section = await howToWin();
    expect(within(section).getByText('D+ de la semaine')).toBeInTheDocument();
    expect(
      within(section).getByText(
        'Le D+ de la semaine se cumule sur tous les sports qui en ont un, en mètres réels, sans coefficient',
      ),
    ).toBeInTheDocument();
    expect(within(section).queryByText(/Une séance compte/)).not.toBeInTheDocument();
  });

  it('explains the elevation gain of the week in English', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, language: 'en' })));
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        { type: 'points', position: 4, params: { criteria: ['weekly_elevation'], podium: 10 } },
      ],
    });
    renderAt(`/challenges/${id}`);

    const section = await howToWin('How to win');
    expect(within(section).getByText('Elevation gain of the week')).toBeInTheDocument();
    expect(
      within(section).getByText(
        'The elevation gain of the week adds up every sport that has one, in real meters, without factor',
      ),
    ).toBeInTheDocument();
  });

  it('lists no factors for points that do not use the distance', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        {
          type: 'points',
          position: 4,
          params: { criteria: ['session_count'], podium: 5, factors: { run: 1, ride: 0.3 } },
        },
      ],
    });
    renderAt(`/challenges/${id}`);

    const details = await screen.findByRole('region', { name: 'Détails' });
    expect(within(details).queryByText('Coefficients de distance')).not.toBeInTheDocument();
  });

  it('gives no minimum session without the number of sessions', async () => {
    answer({
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        {
          type: 'points',
          position: 4,
          params: {
            criteria: ['longest_duration', 'longest_distance'],
            podium: 5,
            min_session_seconds: 1200,
            factors: { run: 1, ride: 0.3 },
          },
        },
      ],
    });
    renderAt(`/challenges/${id}`);

    const section = await howToWin();
    expect(
      within(section).getByText('Top 5 de chaque semaine et critère : 10, 8, 6, 4 et 2 points'),
    ).toBeInTheDocument();
    expect(within(section).queryByText(/Une séance compte/)).not.toBeInTheDocument();
  });

  it('names the elimination in English after the reference sport', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, language: 'en' })));
    answer({
      reference_sport: 'ride',
      categories: [
        { type: 'cumulative_time', position: 1, params: {} },
        { type: 'elimination', position: 3, params: { sport: 'ride', step_meters: 10_000 } },
      ],
    });
    renderAt(`/challenges/${id}`);

    const section = await howToWin('How to win');
    expect(within(section).getByText('Cycling with elimination')).toBeInTheDocument();
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

  it('keeps the link just created and the focus on the tab across its sections', async () => {
    // In week 1, before the end of the registrations: the user may invite.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    answer({ current_week: 1, members_can_invite: true });
    renderAt(`/challenges/${id}`);
    const heading = await title();

    fireEvent.click(await screen.findByRole('button', { name: 'Inviter des amis' }));
    const link = await screen.findByRole('textbox', { name: 'Lien à partager' });

    const nav = screen.getByRole('navigation', { name: 'Sections du défi' });
    for (const name of ['Participants', 'Activités']) {
      const tab = within(nav).getByRole('link', { name });
      tab.focus();
      fireEvent.click(tab);
      await screen.findByRole('link', { name, current: 'page' });
      expect(tab).toHaveFocus();
    }

    expect(screen.getByRole('textbox', { name: 'Lien à partager' })).toBe(link);
    expect(await title()).toBe(heading);
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
