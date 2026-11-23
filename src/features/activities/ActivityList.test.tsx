import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

// The device in the time zone of the mock challenges, unless said otherwise.
function renderList({ deviceTimeZone = 'America/Montreal' } = {}) {
  const router = createMemoryRouter(
    [
      { path: '/activities', element: <ActivityList deviceTimeZone={deviceTimeZone} /> },
      { path: '/activities/:activityId/edit', element: <p>Modification</p> },
    ],
    { initialEntries: ['/activities'] },
  );
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

const item = async (name: string) => screen.findByRole('article', { name });

describe('ActivityList', () => {
  it('shows each activity: sport, start, duration, distance, pace, speed and "manual"', async () => {
    listing([run]);
    renderList();
    const activity = await item('Course');

    expect(within(activity).getByText('19 nov. 2026, 7:30')).toBeInTheDocument();
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

  it('shows the label of the sport "other", and neither distance, pace nor speed without one', async () => {
    listing([padel]);
    renderList();
    const activity = await item('Padel');

    expect(within(activity).queryByText('Distance')).not.toBeInTheDocument();
    expect(within(activity).queryByText('Allure')).not.toBeInTheDocument();
    expect(within(activity).queryByText('Vitesse')).not.toBeInTheDocument();
  });

  it('shows the starts in the time zone of the ongoing challenges, named when not the device’s', async () => {
    listing([run]);
    renderList({ deviceTimeZone: 'Europe/Paris' });

    expect(await screen.findByText('19 nov. 2026, 7:30')).toBeInTheDocument();
    expect(
      screen.getByText('Heures affichées : heure de l’Est nord-américain.'),
    ).toBeInTheDocument();
  });

  it('offers to change or delete an activity that is not locked', async () => {
    listing([run]);
    renderList();
    const activity = await item('Course');

    expect(within(activity).getByRole('link', { name: 'Modifier' })).toHaveAttribute(
      'href',
      `/activities/${RUN_ID}/edit`,
    );
    expect(within(activity).getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
    expect(within(activity).queryByText(/ne peut plus être modifiée/)).not.toBeInTheDocument();
  });

  it('shows a locked activity read only, saying why', async () => {
    listing([padel]);
    renderList();
    const activity = await item('Padel');

    expect(
      within(activity).getByText(
        'La semaine de cette activité est terminée dans un de tes défis : elle ne peut plus être modifiée ni supprimée.',
      ),
    ).toBeInTheDocument();
    expect(within(activity).queryByRole('link')).not.toBeInTheDocument();
    expect(within(activity).queryByRole('button')).not.toBeInTheDocument();
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

  it('says what to do without any activity', async () => {
    listing([]);
    renderList();

    expect(
      await screen.findByText(
        'Aucune activité pour le moment. Ajoute ta première : elle comptera dans les défis dont les dates la contiennent.',
      ),
    ).toBeInTheDocument();
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
          within(screen.getByRole('article', { name: 'Course' })).queryByRole('button'),
        ).not.toBeInTheDocument(),
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

  it('lists the mock activities, a page at a time', async () => {
    renderList();

    expect(await screen.findAllByRole('article')).toHaveLength(20);
    expect(mockActivities.length).toBeGreaterThan(20);
  });
});
