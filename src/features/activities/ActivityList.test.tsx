import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Activity } from '../../api/hooks/useActivities';
import type { components } from '../../api/generated/schema';
import { mockActivities } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ActivityList } from './ActivityList';

type ActivityPage = components['schemas']['ActivityPage'];
type ActivitySummary = components['schemas']['ActivitySummary'];
type ActivityWeekPage = components['schemas']['ActivityWeekPage'];

const RUN_ID = '00000000-0000-4000-8000-0000000001a1';
const LOCKED_ID = '00000000-0000-4000-8000-0000000002a1';

// A run this week, at 7:30 in Montréal, the time zone of the mock challenges.
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

// Padel ("other", no distance) of a week that has ended.
const padel: Activity = {
  ...run,
  id: LOCKED_ID,
  sport_code: 'other',
  sport_label: 'Padel',
  started_at: '2026-11-08T23:00:00.000Z',
  distance_meters: null,
  speed_mps: null,
  pace_seconds_per_km: null,
  locked: true,
};

/** The list answers these pages, one per cursor (none, then "2"...). */
function listing(...pages: Activity[][]) {
  server.use(
    http.get('*/api/v1/me/activities', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      const index = cursor === null ? 0 : Number(cursor) - 1;
      return HttpResponse.json<ActivityPage>({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 2) : null,
      });
    }),
  );
}

// Wednesday 25 Nov 2026, 10:00 in Montréal.
const NOW = new Date('2026-11-25T15:00:00Z');

/** The days of the week of NOW, Monday to Sunday, with these durations. */
function days(...durations: number[]) {
  return Array.from({ length: 7 }, (_, index) => ({
    date: `2026-11-${23 + index}`,
    sessions: durations[index] ? 1 : 0,
    duration_seconds: durations[index] ?? 0,
  }));
}

/** The summary of the week of NOW in Montréal: these totals, days and sports. */
function summary({
  sessions = 0,
  duration = 0,
  distance = 0,
  elevation = 0,
  durations = [] as number[],
  sports = [] as ActivitySummary['sports'],
} = {}): ActivitySummary {
  return {
    current_week: {
      starts_at: '2026-11-23T05:00:00Z',
      ends_at: '2026-11-30T05:00:00Z',
      sessions,
      duration_seconds: duration,
      distance_meters: distance,
      elevation_gain_meters: elevation,
      days: days(...durations),
    },
    sports,
    total: sports.reduce((sum, { count }) => sum + count, 0),
    total_duration_seconds: duration,
    challenge_count: 0,
  };
}

/** The summary answered, and the time zones it was asked in. */
function summarizing(answer: ActivitySummary) {
  const zones: (string | null)[] = [];
  server.use(
    http.get('*/api/v1/me/activities/summary', ({ request }) => {
      zones.push(new URL(request.url).searchParams.get('tz'));
      return HttpResponse.json(answer);
    }),
  );
  return zones;
}

/** The weeks answered, and the queries (`tz`, `sport`) they were asked with. */
function weeksTotals(...items: ActivityWeekPage['items']) {
  const asked: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/me/activities/weeks', ({ request }) => {
      asked.push(new URL(request.url).searchParams);
      return HttpResponse.json<ActivityWeekPage>({ items, next_cursor: null });
    }),
  );
  return asked;
}

/** The totals of the week of `monday` (Montréal, standard time). */
const weekOf = (
  monday: string,
  sessions: number,
  duration: number,
  distance: number,
  elevation = 0,
) => ({
  starts_at: `${monday}T05:00:00Z`,
  ends_at: new Date(Date.parse(`${monday}T05:00:00Z`) + 7 * 86_400_000).toISOString(),
  sessions,
  duration_seconds: duration,
  distance_meters: distance,
  elevation_gain_meters: elevation,
});

// The device in the time zone of the mock challenges, unless said otherwise.
function renderList({ deviceTimeZone = 'America/Montreal', path = '/activities' } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/activities',
        element: <ActivityList deviceTimeZone={deviceTimeZone} now={NOW} />,
      },
      { path: '/activities/:activityId/edit', element: <p>Modification</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

const item = async (name: string) => screen.findByRole('article', { name });
const week = (name: RegExp) => screen.getByRole('region', { name });
const MENU = "Actions de l'activité";

/** The value of a stat of an activity (`term`: its label), spaces made plain. */
const statOf = (activity: HTMLElement, term: string) =>
  within(activity)
    .queryByText(term, { selector: 'dt' })
    ?.parentElement?.querySelector('dd')
    ?.textContent?.replace(/\s+/g, ' ');

/** Opens the "…" menu of an activity. */
async function openMenu(name: string) {
  fireEvent.click(within(await item(name)).getByRole('button', { name: MENU }));
}

const contribution = (challenge_title: string, distance_meters: number | null) => ({
  challenge_id: '00000000-0000-4000-8000-0000000000c1',
  challenge_title,
  distance_meters,
  duration_seconds: 2730,
});

// Unless a test says otherwise: one run and one padel, none this week.
beforeEach(() => {
  summarizing(
    summary({
      sports: [
        { sport_code: 'run', count: 1 },
        { sport_code: 'other', count: 1 },
      ],
    }),
  );
});

describe('ActivityList', () => {
  it('shows each activity: sport, start, duration, distance, pace, speed and "manual"', async () => {
    listing([run]);
    renderList();
    const activity = await item('Course');

    expect(within(activity).getByText('jeu. 19 nov. à 7:30')).toBeInTheDocument();
    expect(within(activity).getByText('0:45:30')).toBeInTheDocument();
    expect(within(activity).getByText('8,2 km')).toBeInTheDocument();
    // The pace and the speed the API computed, per km and in km/h.
    expect(within(activity).getByText('Allure')).toBeInTheDocument();
    expect(within(activity).getByText('5:33 /km')).toBeInTheDocument();
    expect(within(activity).getByText('10,8 km/h')).toBeInTheDocument();
    expect(within(activity).getByText('Manuelle')).toBeInTheDocument();
    // Same time zone as the device: no mention.
    expect(screen.queryByText(/Heures affichées/)).not.toBeInTheDocument();
  });

  describe('elevation gain', () => {
    afterEach(async () => {
      await i18n.changeLanguage('fr');
    });

    const ride: Activity = {
      ...run,
      id: '00000000-0000-4000-8000-0000000003a1',
      sport_code: 'ride',
      distance_meters: 31_500,
      elevation_gain_meters: 1250,
    };
    const walk: Activity = {
      ...run,
      id: '00000000-0000-4000-8000-0000000004a1',
      sport_code: 'walk',
      elevation_gain_meters: 0,
    };

    it('shows it as a stat of its own, 0 included, and nothing when not entered', async () => {
      listing([run, ride, walk]);
      renderList();

      const bike = await item('Vélo');
      expect(statOf(bike, 'Distance')).toBe('31,5 km');
      expect(statOf(bike, 'Dénivelé')).toBe('↗ 1 250 m');
      expect(within(bike).getByText('↗')).toHaveAttribute('aria-hidden', 'true');
      expect(statOf(await item('Marche'), 'Dénivelé')).toBe('↗ 0 m');
      expect(statOf(await item('Course'), 'Dénivelé')).toBeUndefined();
    });

    it('writes it in English', async () => {
      await i18n.changeLanguage('en');
      listing([ride]);
      renderList();

      expect(statOf(await item('Cycling'), 'Elevation')).toBe('↗ 1,250 m');
    });
  });

  it('shows the label of the sport "other", no distance, and neither pace nor speed without one', async () => {
    listing([padel]);
    renderList();
    const activity = await item('Padel');

    expect(within(activity).getByText('Distance')).toBeInTheDocument();
    expect(within(activity).getByText('Aucune')).toBeInTheDocument();
    expect(within(activity).queryByText('Allure')).not.toBeInTheDocument();
    expect(within(activity).queryByText('Vitesse')).not.toBeInTheDocument();
  });

  it('shows the starts in the time zone of the ongoing challenges, named when not the device’s', async () => {
    listing([run]);
    renderList({ deviceTimeZone: 'Europe/Paris' });

    expect(await screen.findByText('jeu. 19 nov. à 7:30')).toBeInTheDocument();
    expect(
      screen.getByText('Heures affichées : heure de l’Est nord-américain.'),
    ).toBeInTheDocument();
  });

  it('groups the activities by week, Monday to Sunday, named from today', async () => {
    const today: Activity = {
      ...run,
      id: '00000000-0000-4000-8000-0000000003a1',
      started_at: '2026-11-25T13:05:00Z',
    };
    const yesterday: Activity = {
      ...run,
      id: '00000000-0000-4000-8000-0000000004a1',
      sport_code: 'ride',
      started_at: '2026-11-24T13:05:00Z',
    };
    listing([today, yesterday, run, padel]);
    renderList();
    await item('Vélo');

    const list = screen.getByRole('region', { name: 'Mes activités enregistrées' });
    expect(
      within(list)
        .getAllByRole('heading', { level: 2 })
        .map((title) => title.textContent),
    ).toEqual([
      'Cette semaine · 23–29 nov.',
      'Semaine dernière · 16–22 nov.',
      'Semaine du 2 nov. · 2–8 nov.',
    ]);
    const thisWeek = week(/^Cette semaine/);
    expect(within(thisWeek).getAllByRole('article')).toHaveLength(2);
    expect(within(thisWeek).getByText("Aujourd'hui à 8:05")).toBeInTheDocument();
    expect(within(thisWeek).getByText('Hier à 8:05')).toBeInTheDocument();
    expect(
      within(week(/^Semaine dernière/)).getByRole('article', { name: 'Course' }),
    ).toBeInTheDocument();
    expect(
      within(week(/^Semaine du 2 nov/)).getByRole('article', { name: 'Padel' }),
    ).toBeInTheDocument();
  });

  it('says where an activity counts, "time only" without a distance', async () => {
    listing([
      {
        ...run,
        contributions: [contribution("Défi d'automne", 8200), contribution('Les ruelles', 8200)],
      },
      { ...padel, contributions: [contribution("Défi d'automne", null)] },
    ]);
    renderList();

    expect(
      within(await item('Course')).getByText("Compte pour : Défi d'automne · Les ruelles"),
    ).toBeInTheDocument();
    expect(
      within(await item('Padel')).getByText("Compte pour : Défi d'automne (temps seulement)"),
    ).toBeInTheDocument();
  });

  it('offers to change or delete an activity that is not locked, from its menu', async () => {
    listing([run]);
    renderList();
    const activity = await item('Course');
    const button = within(activity).getByRole('button', { name: MENU });
    expect(button).toHaveAccessibleDescription('Course jeu. 19 nov. à 7:30');
    expect(within(activity).queryByRole('link', { name: 'Modifier' })).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    const edit = within(activity).getByRole('link', { name: 'Modifier' });
    expect(edit).toHaveAttribute('href', `/activities/${RUN_ID}/edit`);
    expect(edit).toHaveFocus();
    expect(within(activity).getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
    expect(within(activity).queryByText('Semaine jugée')).not.toBeInTheDocument();
  });

  it('closes the menu on Escape, the focus back on its button', async () => {
    listing([run]);
    renderList();
    await openMenu('Course');
    const activity = await item('Course');

    fireEvent.keyDown(within(activity).getByRole('link', { name: 'Modifier' }), { key: 'Escape' });

    const button = within(activity).getByRole('button', { name: MENU });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('shows a locked activity read only, its week judged, and the rule below the list', async () => {
    listing([padel]);
    renderList();
    const activity = await item('Padel');

    expect(within(activity).getByText('Semaine jugée')).toBeInTheDocument();
    expect(within(activity).queryByRole('link')).not.toBeInTheDocument();
    expect(within(activity).queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Une activité se modifie ou se supprime tant que sa semaine n'est pas jugée dans tes défis.",
      ),
    ).toBeInTheDocument();
  });

  it('loads the next page on demand', async () => {
    listing([run], [padel]);
    renderList();
    await item('Course');
    expect(screen.queryByRole('article', { name: 'Padel' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Charger plus' }));

    expect(await item('Padel')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Course' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  describe('size of the list', () => {
    /** Answers these pages (one per cursor) and records the query of each request. */
    function recording(...pages: Activity[][]) {
      const queries: URLSearchParams[] = [];
      server.use(
        http.get('*/api/v1/me/activities', ({ request }) => {
          const query = new URL(request.url).searchParams;
          queries.push(query);
          const cursor = query.get('cursor');
          const index = cursor === null ? 0 : Number(cursor) - 1;
          return HttpResponse.json<ActivityPage>({
            items: pages[index] ?? [],
            next_cursor: index + 1 < pages.length ? String(index + 2) : null,
          });
        }),
      );
      return queries;
    }

    it('asks for 10 by default, then 50 once chosen, the sport filter kept', async () => {
      summarizing(summary({ sports: [{ sport_code: 'run', count: 1 }] }));
      const queries = recording([run]);
      renderList({ path: '/activities?sport=run' });

      await item('Course');
      expect(queries.at(-1)?.get('limit')).toBe('10');
      expect(queries.at(-1)?.get('sport')).toBe('run');
      fireEvent.click(screen.getByRole('radio', { name: '50' }));

      await waitFor(() => expect(queries.at(-1)?.get('limit')).toBe('50'));
      expect(queries.at(-1)?.get('sport')).toBe('run');
      expect(queries.at(-1)?.has('cursor')).toBe(false);
      expect(await item('Course')).toBeInTheDocument();
      expect(localStorage.getItem('sport-challenge:page-size:activities')).toBe('50');
    });

    it('reads every page in turn, by 100, when « Tout » is chosen', async () => {
      const queries = recording([run], [padel]);
      renderList();
      await item('Course');

      fireEvent.click(screen.getByRole('radio', { name: 'Tout' }));

      expect(await item('Padel')).toBeInTheDocument();
      expect(queries.at(-1)?.get('limit')).toBe('100');
      expect(queries.at(-1)?.get('cursor')).toBe('2');
      expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
    });

    it("keeps the server's week totals whatever the size shows", async () => {
      weeksTotals(weekOf('2026-11-16', 4, 9360, 26_000), weekOf('2026-11-02', 1, 2730, 0));
      const totalsOf = (region: HTMLElement) => within(region).getByText(/^\d+ séances?/);
      recording([run], [padel]);
      renderList();
      await item('Course');

      fireEvent.click(screen.getByRole('radio', { name: 'Tout' }));

      expect(await item('Padel')).toBeInTheDocument();
      // Not the sum of the activities shown (one each): the server's totals.
      await waitFor(() =>
        expect(totalsOf(week(/^Semaine dernière/))).toHaveTextContent(/^4 séances/),
      );
      expect(totalsOf(week(/^Semaine du 2 nov/))).toHaveTextContent(/^1 séance · 0:45/);
    });
  });

  it('says what to do without any activity, with neither summary nor filter', async () => {
    summarizing(summary());
    listing([]);
    renderList();

    expect(
      await screen.findByText(
        'Aucune activité pour le moment. Ajoute ta première : elle comptera dans les défis dont les dates la contiennent.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Résumé de cette semaine' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('offers a retry when the list fails', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/me/activities', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { code: 'internal_error', message: 'Boom' } },
              { status: 500 },
            )
          : HttpResponse.json<ActivityPage>({ items: [run], next_cursor: null });
      }),
    );
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await item('Course')).toBeInTheDocument();
  });

  describe('deleting', () => {
    /** Answers the deletion with `respond`, keeping the ids asked for. */
    function deleteWith(respond: () => Response) {
      const asked: string[] = [];
      server.use(
        http.delete('*/api/v1/activities/:activityId', ({ params }) => {
          asked.push(String(params.activityId));
          return respond();
        }),
      );
      return asked;
    }

    const openConfirmation = async () => {
      await openMenu('Course');
      fireEvent.click(within(await item('Course')).getByRole('button', { name: 'Supprimer' }));
      return screen.getByRole('dialog', { name: 'Supprimer cette activité ?' });
    };

    it('asks first, and deletes nothing when cancelled', async () => {
      listing([run]);
      const asked = deleteWith(() => new HttpResponse(null, { status: 204 }));
      renderList();
      const dialog = await openConfirmation();

      expect(dialog).toHaveAccessibleDescription(
        'Elle ne comptera plus dans tes défis. Cette action est définitive.',
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(asked).toEqual([]);
      expect(within(await item('Course')).getByRole('button', { name: MENU })).toHaveFocus();
    });

    it('deletes once confirmed, says so and reloads the list', async () => {
      let deleted = false;
      server.use(
        http.get('*/api/v1/me/activities', () =>
          HttpResponse.json<ActivityPage>({ items: deleted ? [] : [run], next_cursor: null }),
        ),
      );
      const asked = deleteWith(() => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      });
      renderList();
      const dialog = await openConfirmation();

      fireEvent.click(within(dialog).getByRole('button', { name: "Supprimer l'activité" }));

      expect(await screen.findByRole('status')).toHaveTextContent('Activité supprimée.');
      expect(screen.getByRole('status')).toHaveFocus();
      await waitFor(() =>
        expect(screen.queryByRole('article', { name: 'Course' })).not.toBeInTheDocument(),
      );
      expect(asked).toEqual([RUN_ID]);
    });

    it('says why when the server finds the week ended, and shows it locked', async () => {
      let refused = false;
      server.use(
        http.get('*/api/v1/me/activities', () =>
          HttpResponse.json<ActivityPage>({
            items: [{ ...run, locked: refused }],
            next_cursor: null,
          }),
        ),
      );
      deleteWith(() => {
        refused = true;
        return HttpResponse.json(
          { error: { code: 'week_locked', message: 'Week locked' } },
          { status: 422 },
        );
      });
      renderList();
      const dialog = await openConfirmation();

      fireEvent.click(within(dialog).getByRole('button', { name: "Supprimer l'activité" }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'La semaine de cette activité vient de se terminer dans un de tes défis : elle ne peut plus être modifiée ni supprimée.',
      );
      await waitFor(() =>
        expect(
          within(screen.getByRole('article', { name: 'Course' })).getByText('Semaine jugée'),
        ).toBeInTheDocument(),
      );
    });

    it('takes an activity already gone as deleted', async () => {
      listing([run]);
      deleteWith(() =>
        HttpResponse.json(
          { error: { code: 'activity_not_found', message: 'Not found' } },
          { status: 404 },
        ),
      );
      renderList();
      const dialog = await openConfirmation();

      fireEvent.click(within(dialog).getByRole('button', { name: "Supprimer l'activité" }));

      expect(await screen.findByRole('status')).toHaveTextContent('Activité supprimée.');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('summary of the week', () => {
    const RIDE_COUNT = [{ sport_code: 'ride', count: 1 }];
    const card = async () => screen.findByRole('region', { name: 'Résumé de cette semaine' });

    it('shows the totals and a bar a day from the server, asked in the time zone of entry', async () => {
      const zones = summarizing(
        summary({
          sessions: 2,
          duration: 4200 + 1800,
          distance: 32_000,
          durations: [4200, 0, 1800],
          sports: [{ sport_code: 'ride', count: 2 }],
        }),
      );
      listing([run]);
      renderList({ deviceTimeZone: 'Europe/Paris' });
      const summaryCard = await card();

      expect(within(summaryCard).getByRole('heading')).toHaveTextContent(
        'Cette semaine · 23–29 nov.',
      );
      expect(within(summaryCard).getByText('2')).toBeInTheDocument();
      expect(within(summaryCard).getByText('séances')).toBeInTheDocument();
      expect(within(summaryCard).getByText('1:40')).toBeInTheDocument();
      expect(within(summaryCard).getByText('32 km')).toBeInTheDocument();
      const bars = within(within(summaryCard).getByRole('list', { name: 'Durée de chaque jour' }))
        .getAllByRole('listitem')
        .map((bar) => bar.textContent);
      expect(bars).toEqual([
        'Llundi 23 novembre : 1 heure 10 minutes',
        'Mmardi 24 novembre : aucune activité',
        'Mmercredi 25 novembre : 30 minutes',
        'Jjeudi 26 novembre : aucune activité',
        'Vvendredi 27 novembre : aucune activité',
        'Ssamedi 28 novembre : aucune activité',
        'Ddimanche 29 novembre : aucune activité',
      ]);
      // Today is Wednesday in Montréal, the zone of entry, not the device's.
      expect(
        within(summaryCard)
          .getAllByRole('listitem')
          .find((bar) => bar.hasAttribute('aria-current')),
      ).toHaveTextContent('mercredi');
      expect(zones).toEqual(['America/Montreal']);
    });

    it('shows a week without activity, in the singular for one session', async () => {
      summarizing(summary({ sports: [{ sport_code: 'run', count: 1 }] }));
      listing([run]);
      renderList();
      const summaryCard = await card();

      expect(within(summaryCard).getByText('séance')).toBeInTheDocument();
      expect(within(summaryCard).getByText('0:00')).toBeInTheDocument();
      expect(within(summaryCard).getByText('0 km')).toBeInTheDocument();
      expect(within(summaryCard).getAllByText(/aucune activité/)).toHaveLength(7);
      // No elevation gain this week: no figure for it.
      expect(within(summaryCard).queryByText('de dénivelé')).not.toBeInTheDocument();
    });

    describe('elevation gain', () => {
      afterEach(async () => {
        await i18n.changeLanguage('fr');
      });

      it("shows the server's elevation gain of the week", async () => {
        summarizing(
          summary({ sessions: 1, distance: 31_500, elevation: 1250, sports: RIDE_COUNT }),
        );
        listing([run]);
        renderList();
        const summaryCard = await card();

        expect(within(summaryCard).getByText('1 250 m')).toBeInTheDocument();
        expect(within(summaryCard).getByText('de dénivelé')).toBeInTheDocument();
      });

      it('writes it in English', async () => {
        await i18n.changeLanguage('en');
        summarizing(
          summary({ sessions: 1, distance: 31_500, elevation: 1250, sports: RIDE_COUNT }),
        );
        listing([run]);
        renderList();
        const summaryCard = await screen.findByRole('region', { name: 'Summary of this week' });

        expect(within(summaryCard).getByText('1,250 m')).toBeInTheDocument();
        expect(within(summaryCard).getByText('climbed')).toBeInTheDocument();
      });
    });

    it('offers a retry when it fails, the list still shown', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/v1/me/activities/summary', () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.json(
                { error: { code: 'internal_error', message: 'Boom' } },
                { status: 500 },
              )
            : HttpResponse.json(summary({ sports: [{ sport_code: 'run', count: 1 }] }));
        }),
      );
      listing([run]);
      renderList();

      expect(await item('Course')).toBeInTheDocument();
      fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));

      expect(await card()).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: 'Filtrer par sport' })).toBeInTheDocument();
    });
  });

  describe('sport filter', () => {
    const SPORTS = [
      { sport_code: 'run', count: 4 },
      { sport_code: 'ride', count: 1 },
      { sport_code: 'other', count: 1 },
    ];

    it("lists the sports in the server's order, with their counts, all of them chosen", async () => {
      summarizing(summary({ sports: SPORTS }));
      listing([run]);
      renderList();
      const group = await screen.findByRole('radiogroup', { name: 'Filtrer par sport' });

      expect(
        within(group)
          .getAllByRole('radio')
          .map((radio) => radio.closest('label')?.textContent),
      ).toEqual([
        'Tous6 activités',
        'Course4 activités',
        'Vélo1 activité',
        'Autre sport1 activité',
      ]);
      expect(within(group).getByRole('radio', { name: /^Tous/ })).toBeChecked();
    });

    it('applies the sport chosen to the list and to the totals of the weeks', async () => {
      summarizing(summary({ sports: SPORTS }));
      const asked = weeksTotals(weekOf('2026-11-16', 1, 2730, 8200));
      const listed: (string | null)[] = [];
      server.use(
        http.get('*/api/v1/me/activities', ({ request }) => {
          const sport = new URL(request.url).searchParams.get('sport');
          listed.push(sport);
          return HttpResponse.json<ActivityPage>({
            items: sport === 'ride' ? [] : [run],
            next_cursor: null,
          });
        }),
      );
      renderList();
      await item('Course');

      fireEvent.click(await screen.findByRole('radio', { name: /^Vélo/ }));

      expect(await screen.findByText('Aucune activité de ce sport.')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /^Vélo/ })).toBeChecked();
      expect(listed).toEqual([null, 'ride']);
      await waitFor(() =>
        expect(asked.map((query) => [query.get('tz'), query.get('sport')])).toEqual([
          ['America/Montreal', null],
          ['America/Montreal', 'ride'],
        ]),
      );
    });
  });

  describe('sport no longer there', () => {
    it('shows every sport when the address names one without activity', async () => {
      summarizing(summary({ sports: [{ sport_code: 'run', count: 1 }] }));
      const listed: (string | null)[] = [];
      server.use(
        http.get('*/api/v1/me/activities', ({ request }) => {
          listed.push(new URL(request.url).searchParams.get('sport'));
          return HttpResponse.json<ActivityPage>({ items: [run], next_cursor: null });
        }),
      );
      renderList({ path: '/activities?sport=ride' });

      expect(await screen.findByRole('radio', { name: /^Tous/ })).toBeChecked();
      await item('Course');
      expect(listed.at(-1)).toBeNull();
    });
  });

  describe('totals of the weeks', () => {
    /** The totals line of a week, its duration also in words for a screen reader. */
    const totalsOf = (region: HTMLElement) => within(region).getByText(/^\d+ séances?/);

    it("shows the server's totals beside each week, the distance left out at 0", async () => {
      weeksTotals(weekOf('2026-11-16', 4, 9360, 26_000), weekOf('2026-11-02', 1, 2730, 0));
      listing([run, padel]);
      renderList();
      await item('Course');

      // The totals come after the list.
      await waitFor(() =>
        expect(totalsOf(week(/^Semaine dernière/))).toHaveTextContent(
          '4 séances · 2:362 heures 36 minutes · 26 km',
        ),
      );
      expect(totalsOf(week(/^Semaine du 2 nov/))).toHaveTextContent(/^1 séance · 0:4545 minutes$/);
    });

    describe('elevation gain', () => {
      afterEach(async () => {
        await i18n.changeLanguage('fr');
      });

      it("shows the server's elevation gain of a week, left out at 0", async () => {
        weeksTotals(
          weekOf('2026-11-16', 4, 9360, 26_000, 1250),
          weekOf('2026-11-02', 1, 2730, 8200, 0),
        );
        listing([run, padel]);
        renderList();
        await item('Course');

        await waitFor(() =>
          expect(totalsOf(week(/^Semaine dernière/))).toHaveTextContent(
            '4 séances · 2:362 heures 36 minutes · 26 km · ↗ 1 250 m1 250 m de dénivelé',
          ),
        );
        expect(within(week(/^Semaine dernière/)).getByText('↗')).toHaveAttribute(
          'aria-hidden',
          'true',
        );
        expect(totalsOf(week(/^Semaine du 2 nov/))).toHaveTextContent(
          /^1 séance · 0:4545 minutes · 8,2 km$/,
        );
      });

      it('writes it in English', async () => {
        await i18n.changeLanguage('en');
        weeksTotals(weekOf('2026-11-16', 4, 9360, 26_000, 1250));
        listing([run]);
        renderList();

        const lastWeek = await screen.findByRole('region', { name: /^Last week/ });
        await waitFor(() =>
          expect(within(lastWeek).getByText(/^\d+ sessions?/)).toHaveTextContent(
            '4 sessions · 2:362 hours 36 minutes · 26 km · ↗ 1,250 m1,250 m climbed',
          ),
        );
      });
    });

    it('loads more weeks while a week shown has no totals yet', async () => {
      server.use(
        http.get('*/api/v1/me/activities/weeks', ({ request }) => {
          const later = new URL(request.url).searchParams.get('cursor') === '2';
          return HttpResponse.json<ActivityWeekPage>({
            items: [later ? weekOf('2026-11-02', 1, 2730, 0) : weekOf('2026-11-16', 1, 2730, 8200)],
            next_cursor: later ? null : '2',
          });
        }),
      );
      listing([run, padel]);
      renderList();

      const older = await screen.findByRole('region', { name: /^Semaine du 2 nov/ });
      await waitFor(() => expect(totalsOf(older)).toHaveTextContent('1 séance · 0:45'));
    });

    it('keeps the list and offers a retry when they fail', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/v1/me/activities/weeks', () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.json(
                { error: { code: 'internal_error', message: 'Boom' } },
                { status: 500 },
              )
            : HttpResponse.json<ActivityWeekPage>({
                items: [weekOf('2026-11-16', 1, 2730, 8200)],
                next_cursor: null,
              });
        }),
      );
      listing([run]);
      renderList();

      const retry = await screen.findByRole('button', { name: 'Réessayer' });
      expect(screen.getByRole('article', { name: 'Course' })).toBeInTheDocument();
      fireEvent.click(retry);

      await waitFor(() =>
        expect(totalsOf(week(/^Semaine dernière/))).toHaveTextContent('1 séance · 0:45'),
      );
      expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    });
  });

  it('lists the mock activities, 10 at a time by default', async () => {
    renderList();

    expect(await screen.findAllByRole('article')).toHaveLength(10);
    expect(mockActivities.length).toBeGreaterThan(10);
  });
});
