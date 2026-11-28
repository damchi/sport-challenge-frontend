import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Activity, ActivityCreate } from '../../api/hooks/useActivities';
import type { components } from '../../api/generated/schema';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { failure, refreshAll } from '../../test/refresh';
import { createTestQueryClient } from '../../test/render';
import { ActivityEdit } from './ActivityEdit';

type ActivityPage = components['schemas']['ActivityPage'];

const RUN_ID = '00000000-0000-4000-8000-0000000001a1';

// Friday 20 November 2026, noon in Montréal, the time zone of the mock
// challenges.
const NOW = new Date('2026-11-20T17:00:00Z');

// A run this week: 7:30 in Montréal, 45 min 30 s, 8.2 km.
const run: Activity = {
  id: RUN_ID,
  sport_code: 'run',
  sport_label: null,
  started_at: '2026-11-19T12:30:00.000Z',
  duration_seconds: 2730,
  distance_meters: 8200,
  elevation_gain_meters: null,
  source: 'manual',
  speed_mps: 3,
  pace_seconds_per_km: 333,
  contributions: [],
  locked: false,
};

/** The list answers these pages, one per cursor (none, then "2"...). */
function listing(...pages: Activity[][]) {
  const cursors: (string | null)[] = [];
  server.use(
    http.get('*/api/v1/me/activities', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      cursors.push(cursor);
      const index = cursor === null ? 0 : Number(cursor) - 1;
      return HttpResponse.json<ActivityPage>({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 2) : null,
      });
    }),
  );
  return cursors;
}

/** Answers the change with `respond`, keeping each request's id and body. */
function replaceWith(respond: (body: ActivityCreate) => Response) {
  const sent: { id: string; body: ActivityCreate }[] = [];
  server.use(
    http.patch('*/api/v1/activities/:activityId', async ({ params, request }) => {
      const body = (await request.json()) as ActivityCreate;
      sent.push({ id: String(params.activityId), body });
      return respond(body);
    }),
  );
  return sent;
}

function refusal(code: string, status: number) {
  return HttpResponse.json({ error: { code, message: 'Refused' } }, { status });
}

function renderEdit(activityId: string = RUN_ID, queryClient = createTestQueryClient()) {
  const router = createMemoryRouter(
    [
      {
        path: '/activities/:activityId/edit',
        element: <ActivityEdit now={() => NOW} deviceTimeZone="Asia/Tokyo" />,
      },
      { path: '/activities', element: <p>Mes activités (page)</p> },
    ],
    { initialEntries: [`/activities/${activityId}/edit`] },
  );
  render(
    <AppProviders
      auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}
      queryClient={queryClient}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

const save = () => screen.getByRole('button', { name: 'Enregistrer les modifications' });

describe('ActivityEdit', () => {
  it('opens the activity in the form, its start in the time zone of the challenges', async () => {
    listing([run]);
    renderEdit();

    expect(await screen.findByRole('radio', { name: 'Course' })).toBeChecked();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-19');
    expect(screen.getByRole('textbox', { name: 'Heure de début' })).toHaveValue('07');
    expect(screen.getByRole('textbox', { name: 'Minutes de début' })).toHaveValue('30');
    expect(screen.getByRole('textbox', { name: 'Heures' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Minutes' })).toHaveValue('45');
    expect(screen.getByRole('textbox', { name: 'Secondes' })).toHaveValue('30');
    expect(screen.getByRole('textbox', { name: 'Distance en kilomètres' })).toHaveValue('8,2');
  });

  it.each([500, 429] as const)(
    'keeps the changes under way when the data fails to reload (%i)',
    async (status) => {
      listing([run]);
      const queryClient = createTestQueryClient();
      renderEdit(RUN_ID, queryClient);
      const minutes = await screen.findByRole('textbox', { name: 'Minutes' });
      fireEvent.change(minutes, { target: { value: '50' } });

      server.use(
        http.get('*/api/v1/me/activities', () => failure(status)),
        http.get('*/api/v1/challenges', () => failure(status)),
        http.get('*/api/v1/sports', () => failure(status)),
      );
      await refreshAll(queryClient);

      expect(screen.getByRole('textbox', { name: 'Minutes' })).toHaveValue('50');
      expect(screen.getByRole('radio', { name: 'Course' })).toBeChecked();
      expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    },
  );

  it('offers a retry when the time zone cannot load at first', async () => {
    listing([run]);
    let calls = 0;
    server.use(
      // The first answer fails; the next ones are the mock challenges'.
      http.get('*/api/v1/challenges', () => {
        calls += 1;
        return calls === 1 ? failure(500) : undefined;
      }),
    );
    renderEdit();

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('radio', { name: 'Course' })).toBeChecked();
  });

  it('finds an activity beyond the first page, by 100, whatever size the list shows', async () => {
    localStorage.setItem('sport-challenge:page-size:activities', '10');
    const limits: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/me/activities')) limits.push(url.searchParams.get('limit'));
    });
    const cursors = listing([{ ...run, id: '00000000-0000-4000-8000-0000000001b2' }], [run]);
    renderEdit();

    try {
      expect(await screen.findByRole('radio', { name: 'Course' })).toBeChecked();
      expect(cursors).toEqual([null, '2']);
      expect(limits).toEqual(['100', '100']);
    } finally {
      server.events.removeAllListeners();
    }
  });

  it('replaces the activity and shows where it now counts', async () => {
    listing([run]);
    const sent = replaceWith((body) =>
      HttpResponse.json<Activity>({
        ...run,
        ...body,
        contributions: [
          {
            challenge_id: '00000000-0000-4000-8000-000000000002',
            challenge_title: 'Défi 2',
            distance_meters: 10_000,
            duration_seconds: 2730,
          },
        ],
      }),
    );
    renderEdit();
    const distance = await screen.findByRole('textbox', { name: 'Distance en kilomètres' });

    fireEvent.change(distance, { target: { value: '10' } });
    fireEvent.click(save());

    expect(await screen.findByText('Activité modifiée.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Défi 2/ })).toBeInTheDocument();
    expect(sent).toEqual([
      {
        id: RUN_ID,
        body: {
          sport_code: 'run',
          started_at: '2026-11-19T12:30:00.000Z',
          duration_seconds: 2730,
          distance_meters: 10_000,
        },
      },
    ]);
  });

  it('asks before leaving a changed activity, not an untouched one', async () => {
    listing([run]);
    renderEdit();
    const distance = await screen.findByRole('textbox', { name: 'Distance en kilomètres' });
    fireEvent.change(distance, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('link', { name: 'Annuler' }));

    const dialog = await screen.findByRole('dialog', { name: 'Quitter la saisie ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quitter' }));
    expect(await screen.findByText('Mes activités (page)')).toBeInTheDocument();
  });

  it('says why when the server finds the week ended', async () => {
    listing([run]);
    replaceWith(() => refusal('week_locked', 422));
    renderEdit();
    await screen.findByRole('group', { name: 'Sport' });

    fireEvent.click(save());

    // The old week or the new one: the server does not say which.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une semaine terminée dans un de tes défis bloque ce changement : la nouvelle date est dans une semaine terminée, ou la semaine de cette activité vient de se terminer. Vérifie la date de début.',
    );
  });

  it('shows it locked once the server says so after a refusal', async () => {
    let refused = false;
    server.use(
      http.get('*/api/v1/me/activities', () =>
        HttpResponse.json<ActivityPage>({
          items: [{ ...run, locked: refused }],
          next_cursor: null,
        }),
      ),
    );
    replaceWith(() => {
      refused = true;
      return refusal('week_locked', 422);
    });
    renderEdit();
    await screen.findByRole('group', { name: 'Sport' });

    fireEvent.click(save());

    expect(
      await screen.findByText(
        'La semaine de cette activité est terminée dans un de tes défis : elle ne peut plus être modifiée ni supprimée.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sport' })).not.toBeInTheDocument();
  });

  describe('repetitions', () => {
    // Burpees no challenge offers any more: the mock challenges have no exercise.
    const kept = { ...run, repetitions: [{ exercise: 'burpee', repetitions: 120 }] };
    const burpees = () => screen.findByRole('textbox', { name: 'Burpees en répétitions' });

    it('keeps an exercise no longer offered, shown and sent as it is', async () => {
      listing([kept]);
      const sent = replaceWith((body) => HttpResponse.json<Activity>({ ...kept, ...body }));
      renderEdit();
      expect(await burpees()).toHaveValue('120');

      fireEvent.click(save());

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]?.body.repetitions).toEqual([{ exercise: 'burpee', repetitions: 120 }]);
    });

    it('removes them once emptied: the change leaves them out', async () => {
      listing([kept]);
      const sent = replaceWith((body) => HttpResponse.json<Activity>({ ...run, ...body }));
      renderEdit();

      fireEvent.change(await burpees(), { target: { value: '' } });
      fireEvent.click(save());

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]?.body).not.toHaveProperty('repetitions');
    });
  });

  describe('elevation gain', () => {
    const elevation = () => screen.findByRole('textbox', { name: 'Dénivelé positif en mètres' });

    it('opens with the one recorded and sends it changed', async () => {
      listing([{ ...run, elevation_gain_meters: 85 }]);
      const sent = replaceWith((body) => HttpResponse.json<Activity>({ ...run, ...body }));
      renderEdit();
      const field = await elevation();
      expect(field).toHaveValue('85');

      fireEvent.change(field, { target: { value: '120' } });
      fireEvent.click(save());

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]?.body.elevation_gain_meters).toBe(120);
    });

    it('keeps an untouched activity untouched: leaving asks nothing', async () => {
      listing([{ ...run, elevation_gain_meters: 85 }]);
      renderEdit();
      expect(await elevation()).toHaveValue('85');

      fireEvent.click(screen.getByRole('link', { name: 'Annuler' }));

      expect(await screen.findByText('Mes activités (page)')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('is removed once emptied: the change leaves it out', async () => {
      listing([{ ...run, elevation_gain_meters: 85 }]);
      const sent = replaceWith((body) => HttpResponse.json<Activity>({ ...run, ...body }));
      renderEdit();

      fireEvent.change(await elevation(), { target: { value: '' } });
      fireEvent.click(save());

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]?.body).toEqual({
        sport_code: 'run',
        started_at: '2026-11-19T12:30:00.000Z',
        duration_seconds: 2730,
        distance_meters: 8200,
      });
    });
  });

  it('offers no distance for a sport without one', async () => {
    listing([{ ...run, sport_code: 'yoga', distance_meters: null, speed_mps: null }]);
    const sent = replaceWith((body) => HttpResponse.json<Activity>({ ...run, ...body }));
    renderEdit();

    expect(await screen.findByRole('radio', { name: 'Yoga' })).toBeChecked();
    expect(
      screen.queryByRole('textbox', { name: 'Distance en kilomètres' }),
    ).not.toBeInTheDocument();
    fireEvent.click(save());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({
      sport_code: 'yoga',
      started_at: '2026-11-19T12:30:00.000Z',
      duration_seconds: 2730,
    });
  });

  it('says when the activity is gone meanwhile', async () => {
    listing([run]);
    replaceWith(() => refusal('activity_not_found', 404));
    renderEdit();
    await screen.findByRole('group', { name: 'Sport' });

    fireEvent.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Cette activité n'existe pas ou plus.",
    );
  });

  it('shows a locked activity read only, without the form', async () => {
    listing([{ ...run, locked: true }]);
    renderEdit();

    expect(
      await screen.findByText(
        'La semaine de cette activité est terminée dans un de tes défis : elle ne peut plus être modifiée ni supprimée.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sport' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('looks for the activity in the next pages', async () => {
    const other = { ...run, id: '00000000-0000-4000-8000-0000000009a1' };
    const cursors = listing([other], [run]);
    renderEdit();

    expect(await screen.findByRole('radio', { name: 'Course' })).toBeChecked();
    expect(cursors).toEqual([null, '2']);
  });

  it('says so when the user has no such activity', async () => {
    listing([run]);
    renderEdit('00000000-0000-4000-8000-0000000009a1');

    expect(await screen.findByText("Cette activité n'existe pas ou plus.")).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sport' })).not.toBeInTheDocument();
  });

  it('asks nothing of the API for an id that cannot be one', async () => {
    const cursors = listing([run]);
    renderEdit('not-an-id');

    expect(await screen.findByText("Cette activité n'existe pas ou plus.")).toBeInTheDocument();
    await waitFor(() => expect(cursors).toEqual([]));
  });
});
