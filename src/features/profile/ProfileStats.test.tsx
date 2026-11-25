import { fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import type { ActivitySummary } from '../../api/hooks/useActivities';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { failure, refreshAll } from '../../test/refresh';
import { createTestQueryClient } from '../../test/render';
import { ProfileStats } from './ProfileStats';

const EMPTY_WEEK: ActivitySummary['current_week'] = {
  starts_at: '2026-11-23T05:00:00Z',
  ends_at: '2026-11-30T05:00:00Z',
  sessions: 0,
  duration_seconds: 0,
  distance_meters: 0,
  elevation_gain_meters: 0,
  days: [],
};

function answering(counts: { challenges: number; activities: number; seconds: number }) {
  server.use(
    http.get('*/api/v1/me/activities/summary', () =>
      HttpResponse.json<ActivitySummary>({
        current_week: EMPTY_WEEK,
        sports: [],
        total: counts.activities,
        total_duration_seconds: counts.seconds,
        challenge_count: counts.challenges,
      }),
    ),
  );
}

function renderStats(queryClient = createTestQueryClient()) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  render(
    <AppProviders auth={auth} queryClient={queryClient}>
      <ProfileStats />
    </AppProviders>,
  );
}

async function items() {
  const list = await screen.findByRole('list', { name: 'Tes chiffres' });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

describe('ProfileStats', () => {
  afterEach(async () => {
    await i18n.changeLanguage('fr');
  });

  it('shows the challenges, the activities and their time, as the server counts them', async () => {
    answering({ challenges: 3, activities: 18, seconds: 14 * 3600 + 30 * 60 + 12 });
    renderStats();

    expect(await items()).toEqual([
      '3défis',
      '18activités',
      '14 h 30de sport14 heures 30 minutes de sport',
    ]);
  });

  it('says one in the singular, and no time yet as 0 min', async () => {
    answering({ challenges: 1, activities: 1, seconds: 0 });
    renderStats();

    expect(await items()).toEqual(['1défi', '1activité', '0 minde sport0 minute de sport']);
  });

  it('writes whole hours without minutes', async () => {
    answering({ challenges: 0, activities: 2, seconds: 14 * 3600 + 59 });
    renderStats();

    expect((await items())[2]).toBe('14 hde sport14 heures de sport');
  });

  it('pads the minutes after the hours', async () => {
    answering({ challenges: 0, activities: 2, seconds: 2 * 3600 + 5 * 60 });
    renderStats();

    expect((await items())[2]).toBe('2 h 05de sport2 heures 5 minutes de sport');
  });

  it('speaks English', async () => {
    await i18n.changeLanguage('en');
    answering({ challenges: 2, activities: 1, seconds: 45 * 60 });
    renderStats();

    const list = await screen.findByRole('list', { name: 'Your numbers' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['2challenges', '1activity', '45 minof sport45 minutes of sport']);
  });

  it('holds their place while they load', async () => {
    answering({ challenges: 3, activities: 18, seconds: 3600 });
    renderStats();

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(await items()).toHaveLength(3);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says when the numbers could not load, and retries them alone', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/me/activities/summary', () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json<ActivitySummary>({
              current_week: EMPTY_WEEK,
              sports: [],
              total: 4,
              total_duration_seconds: 3600,
              challenge_count: 2,
            });
      }),
    );
    renderStats();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Tes chiffres n'ont pas pu être chargés.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await items()).toEqual(['2défis', '4activités', '1 hde sport1 heure de sport']);
  });

  it.each([500, 429] as const)(
    'keeps the numbers when their refresh fails (%i)',
    async (status) => {
      answering({ challenges: 3, activities: 18, seconds: 3600 });
      const queryClient = createTestQueryClient();
      renderStats(queryClient);
      expect(await items()).toHaveLength(3);

      server.use(http.get('*/api/v1/me/activities/summary', () => failure(status)));
      await refreshAll(queryClient);

      expect(await items()).toEqual(['3défis', '18activités', '1 hde sport1 heure de sport']);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );
});
