import { render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { mockChallenges } from '../../mocks/handlers';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ChallengeCard } from './ChallengeCard';

const found = mockChallenges[0];
if (!found) throw new Error('No mock challenge');
const base: ChallengeSummary = {
  ...found,
  title: 'Défi d’automne',
  visibility: 'public',
  participant_count: 8,
  my_role: 'creator',
  my_status: 'active',
  best_result: null,
};

type Ranking = NonNullable<ChallengeSummary['my_week']>['rankings'][number];

function rank(type: Ranking['type'], value: number, count: number): Ranking {
  return { type, rank: value, ranked_count: count, elimination: null, provisional_points: null };
}

/** An ongoing challenge in week `week` of 4, ending on Saturday 28 November in Montréal. */
function ongoing(week: number, rankings: Ranking[]): ChallengeSummary {
  return {
    ...base,
    status: 'ongoing',
    week_count: 4,
    current_week: week,
    week_ends_at: '2026-11-28T05:00:00Z',
    my_week: { week, week_ends_at: '2026-11-28T05:00:00Z', rankings },
  };
}

/** Renders the card on a device set to the given time zone. */
function renderCard(challenge: ChallengeSummary, deviceTimeZone = 'America/Montreal') {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone: deviceTimeZone };
  });
  const router = createMemoryRouter([
    { path: '/', element: <ChallengeCard challenge={challenge} /> },
  ]);
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return screen.getByRole('link');
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ChallengeCard', () => {
  it('shows the week of 4 and my rank in each category, the elimination at risk', () => {
    const card = renderCard(
      ongoing(3, [
        rank('cumulative_time', 4, 8),
        rank('cumulative_distance', 2, 8),
        {
          ...rank('elimination', 5, 8),
          elimination: {
            status: 'at_risk',
            eliminated_week: null,
            minimum_meters: 25_000,
            distance_meters: 18_000,
            week_ends_at: '2026-11-28T05:00:00Z',
          },
        },
        { ...rank('points', 2, 8), provisional_points: 4 },
      ]),
    );

    expect(card).toHaveAttribute('href', `/challenges/${base.id}`);
    expect(card).toHaveClass('border-risk-border');
    // The card says it is at risk, and so does its elimination line.
    expect(within(card).getAllByText('À risque')).toHaveLength(2);
    expect(card).toHaveTextContent("Public · 8 participants · tu l'as créé");
    expect(card).toHaveTextContent('Sem. 3 sur 4 · se termine sam. 28 nov., 00 h');
    expect(card).toHaveTextContent('Semaine 3 sur 4 · se termine samedi 28 nov., 00 h');
    const [time, distance, elimination, points] = within(card).getAllByRole('listitem');
    expect(time).toHaveTextContent('Temps cumulé4e sur 8');
    expect(distance).toHaveTextContent('Distance cumulée2e sur 8');
    expect(elimination).toHaveTextContent('Course avec élimination');
    expect(elimination).toHaveTextContent('18 km / 25 km');
    expect(elimination).not.toHaveTextContent('5e sur 8');
    expect(points).toHaveTextContent('Grand prix2e sur 8+ 4 pts provisoires');
  });

  it('shows the distance alone in week 1 of the elimination, no rank', () => {
    const card = renderCard(
      ongoing(1, [
        {
          ...rank('elimination', 1, 2),
          elimination: {
            status: null,
            eliminated_week: null,
            minimum_meters: null,
            distance_meters: 12_000,
            week_ends_at: '2026-11-28T05:00:00Z',
          },
        },
      ]),
    );

    expect(card).not.toHaveClass('border-risk-border');
    expect(within(card).queryByText('À risque')).not.toBeInTheDocument();
    const [elimination] = within(card).getAllByRole('listitem');
    expect(elimination).toHaveTextContent("12 kmPas d'élimination en semaine 1");
    expect(elimination).not.toHaveTextContent('1er sur 2');
  });

  describe('an elimination by repetitions', () => {
    // As the contract gives it: no meters, the week in repetitions.
    const burpees = (week: number, elimination: Partial<NonNullable<Ranking['elimination']>>) => ({
      ...ongoing(week, [
        {
          ...rank('elimination', 2, 6),
          elimination: {
            status: 'at_risk' as const,
            eliminated_week: null,
            minimum_meters: null,
            distance_meters: 0,
            week_ends_at: '2026-11-28T05:00:00Z',
            ...elimination,
          },
        },
      ]),
      reference_sport: 'crossfit',
      exercise: 'burpee',
    });

    it('shows the week in repetitions against its minimum, with the exercise', () => {
      const card = renderCard(burpees(3, { repetitions: 80, minimum_repetitions: 120 }));

      const elimination = within(card).getByRole('listitem');
      expect(elimination).toHaveTextContent('Élimination · Burpees');
      expect(elimination).toHaveTextContent('80 rép. / 120 rép.');
      expect(elimination).not.toHaveTextContent('km');
    });

    it('shows the repetitions alone in week 1', () => {
      const card = renderCard(
        burpees(1, { status: null, repetitions: 45, minimum_repetitions: null }),
      );

      expect(within(card).getByRole('listitem')).toHaveTextContent(
        "Élimination · Burpees45 rép.Pas d'élimination en semaine 1",
      );
    });

    it('says the week of the elimination once eliminated', () => {
      const card = renderCard(
        burpees(4, {
          status: 'eliminated',
          eliminated_week: 3,
          week_ends_at: null,
          repetitions: 0,
          minimum_repetitions: null,
        }),
      );

      expect(within(card).getByRole('listitem')).toHaveTextContent(
        'Élimination · BurpeesÉliminé en semaine 3',
      );
    });

    it('writes the repetitions in English', async () => {
      await i18n.changeLanguage('en');
      try {
        const card = renderCard(burpees(3, { repetitions: 1, minimum_repetitions: 2 }));

        expect(within(card).getByRole('listitem')).toHaveTextContent(
          'Elimination · BurpeesAt risk1 rep / 2 reps',
        );
      } finally {
        await i18n.changeLanguage('fr');
      }
    });
  });

  it('shares a rank between tied participants, as the server gives it', () => {
    const card = renderCard(ongoing(2, [rank('cumulative_distance', 1, 2)]));

    expect(within(card).getByRole('listitem')).toHaveTextContent('Distance cumulée1er sur 2');
  });

  it('says the week of the elimination instead of a distance once eliminated', () => {
    const card = renderCard(
      ongoing(4, [
        {
          ...rank('elimination', 6, 6),
          elimination: {
            status: 'eliminated',
            eliminated_week: 3,
            minimum_meters: null,
            distance_meters: 0,
            week_ends_at: null,
          },
        },
      ]),
    );

    expect(within(card).getByRole('listitem')).toHaveTextContent('Éliminé en semaine 3');
  });

  it('shows the week to someone outside the challenge, in its time zone, without lines', () => {
    const card = renderCard(
      { ...ongoing(3, []), my_role: 'outsider', my_status: null, my_week: null },
      'Europe/Paris',
    );

    // Midnight in Montréal, not 6 a.m. in Paris.
    expect(card).toHaveTextContent('Semaine 3 sur 4 · se termine samedi 28 nov., 00 h');
    expect(within(card).queryByRole('list')).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Public · 8 participants');
    expect(card).not.toHaveTextContent('tu ');
  });

  it('shows no week when the server gives no current week', () => {
    const card = renderCard({
      ...ongoing(3, []),
      current_week: null,
      week_ends_at: null,
      my_week: null,
    });

    expect(card).not.toHaveTextContent('Semaine');
    expect(card).not.toHaveTextContent('Sem.');
  });

  it('counts the days before an upcoming challenge, and says I abandoned it', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Sunday 22 November, 23:00 in Montréal (already the 23rd in UTC).
    vi.setSystemTime(new Date('2026-11-23T04:00:00Z'));
    const card = renderCard({
      ...base,
      title: 'Challenge des braves',
      status: 'upcoming',
      starts_at: '2026-12-01T05:00:00Z',
      ends_at: '2027-01-12T05:00:00Z',
      participant_count: 1,
      my_status: 'abandoned',
      my_week: null,
    });

    expect(within(card).getByText('Abandonné')).toBeInTheDocument();
    expect(within(card).getByText('Tu as abandonné')).toBeInTheDocument();
    expect(card).toHaveTextContent('Commence mardi 1 déc. · dans 9 jours');
    expect(card).toHaveTextContent(
      "Du 1 déc. 2026 au 11 janv. 2027 · Public · 1 participant · tu l'as créé",
    );
  });

  it('says an upcoming challenge starts today once its first day has come', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Just past the start, before the server says it is ongoing.
    vi.setSystemTime(new Date('2026-12-01T05:00:30Z'));
    const card = renderCard({ ...base, status: 'upcoming', starts_at: '2026-12-01T05:00:00Z' });

    expect(card).toHaveTextContent("Commence mardi 1 déc. · aujourd'hui");
  });

  it('shows my best result in a finished challenge, and its last day', () => {
    const card = renderCard({
      ...base,
      title: 'Défi d’octobre',
      status: 'finished',
      visibility: 'private',
      participant_count: 5,
      my_role: 'participant',
      starts_at: '2026-10-05T04:00:00Z',
      ends_at: '2026-11-01T04:00:00Z',
      my_week: null,
      best_result: { type: 'cumulative_distance', rank: 2, ranked_count: 5 },
    });

    expect(card).toHaveTextContent('2e en distance cumulée · ton meilleur résultat');
    expect(card).toHaveTextContent(
      'Terminé le 31 oct. 2026 · Privé · 5 participants · tu participes',
    );
  });

  it('keeps the name of the Grand prix in my best result', () => {
    const card = renderCard({
      ...base,
      status: 'finished',
      my_week: null,
      best_result: { type: 'points', rank: 1, ranked_count: 5 },
    });

    expect(card).toHaveTextContent('1er en Grand prix');
  });

  it('keeps the capitals of the total elevation gain in my best result', () => {
    const card = renderCard({
      ...base,
      status: 'finished',
      my_week: null,
      best_result: { type: 'cumulative_elevation', rank: 1, ranked_count: 5 },
    });

    expect(card).toHaveTextContent('1er en D+ cumulé');
  });

  it('shows my rank in the total elevation gain of an ongoing challenge', () => {
    const card = renderCard(
      ongoing(2, [rank('cumulative_time', 3, 6), rank('cumulative_elevation', 1, 6)]),
    );

    const rows = within(card).getAllByRole('listitem');
    expect(rows[1]).toHaveTextContent('D+ cumulé');
    expect(rows[1]).toHaveTextContent('1er sur 6');
  });

  it('says I abandoned an ongoing challenge, with its week but without my lines', () => {
    const card = renderCard({
      ...ongoing(2, []),
      my_role: 'abandoned',
      my_status: 'abandoned',
      my_week: null,
    });

    expect(within(card).getByText('Tu as abandonné')).toBeInTheDocument();
    expect(card).toHaveTextContent('Semaine 2 sur 4 · se termine samedi 28 nov., 00 h');
    expect(within(card).queryByRole('list')).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent('tu ');
  });

  it('shows the bar of an elimination in progress, without a pill', () => {
    const card = renderCard(
      ongoing(2, [
        {
          ...rank('elimination', 3, 6),
          elimination: {
            status: 'in_progress',
            eliminated_week: null,
            minimum_meters: 20_000,
            distance_meters: 5_000,
            week_ends_at: '2026-11-28T05:00:00Z',
          },
        },
      ]),
    );

    const row = within(card).getByRole('listitem');
    expect(row).toHaveTextContent('5 km / 20 km');
    expect(within(row).queryByText('En cours')).not.toBeInTheDocument();
    expect(card).not.toHaveClass('border-risk-border');
  });

  it('shows no best result when the server gives none', () => {
    const card = renderCard({ ...base, status: 'finished', my_week: null, best_result: null });

    expect(card).not.toHaveTextContent('meilleur résultat');
  });

  it('names the challenge time zone when the device is elsewhere', () => {
    const zone = otherTimeZoneName('America/Montreal', 'Europe/Paris', 'fr');
    const card = renderCard({ ...base, status: 'finished' }, 'Europe/Paris');

    expect(card).toHaveTextContent(`Terminé le 29 nov. 2026 · ${zone} · Public`);
  });
});
