import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { mockChallenges } from '../../mocks/handlers';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ChallengeCard } from './ChallengeCard';

const found = mockChallenges[0];
if (!found) throw new Error('No mock challenge');
const montreal = found;

/** Renders the card on a device set to the given time zone. */
function renderCardIn(deviceTimeZone: string, challenge = montreal) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone: deviceTimeZone };
  });
  const router = createMemoryRouter([
    {
      path: '/',
      element: <ChallengeCard challenge={challenge} showStatus />,
    },
  ]);
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChallengeCard', () => {
  it('names the challenge time zone when the device is elsewhere', () => {
    const zone = otherTimeZoneName('America/Montreal', 'Europe/Paris', 'fr');
    renderCardIn('Europe/Paris');

    expect(screen.getByText(/Du 2 nov\. au 29 nov\./)).toHaveTextContent(`· ${zone}`);
  });

  it('shows the period alone in the challenge time zone', () => {
    renderCardIn('America/Montreal');

    expect(screen.getByText('Du 2 nov. au 29 nov.')).toBeInTheDocument();
  });

  it('shows nothing of the week when the server gives none', () => {
    renderCardIn('America/Montreal', { ...montreal, my_week: null });

    expect(screen.queryByText(/Semaine/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the week and the rank in each category, with the provisional points', () => {
    renderCardIn('America/Montreal', {
      ...montreal,
      status: 'ongoing',
      my_week: {
        week: 3,
        week_ends_at: '2026-11-23T05:00:00Z',
        rankings: [
          {
            type: 'cumulative_time',
            rank: 1,
            ranked_count: 6,
            elimination: null,
            provisional_points: null,
          },
          {
            type: 'elimination',
            rank: 5,
            ranked_count: 8,
            elimination: {
              status: 'at_risk',
              eliminated_week: null,
              minimum_meters: 25_000,
              distance_meters: 18_000,
              week_ends_at: '2026-11-23T05:00:00Z',
            },
            provisional_points: null,
          },
          { type: 'points', rank: 2, ranked_count: 6, elimination: null, provisional_points: 12 },
        ],
      },
    });

    const week = within(screen.getByRole('link'));
    expect(week.getByText('Semaine 3')).toBeInTheDocument();
    expect(week.getByText(/^Fin de la semaine : /)).toBeInTheDocument();
    const [time, elimination, points] = week.getAllByRole('listitem') as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(time).toHaveTextContent('Temps cumulé1er sur 6');
    // The list gives no reference sport: a generic name.
    expect(elimination).toHaveTextContent('Élimination');
    expect(elimination).toHaveTextContent('À risque');
    expect(elimination).toHaveTextContent('18 km sur 25 km cette semaine');
    expect(elimination).toHaveTextContent('5e sur 8');
    expect(points).toHaveTextContent('Grand prix2e sur 6 + 12 pts provisoires');
  });

  it('says the week of the elimination instead of a rank once eliminated', () => {
    renderCardIn('America/Montreal', {
      ...montreal,
      status: 'ongoing',
      my_week: {
        week: 4,
        week_ends_at: '2026-11-30T05:00:00Z',
        rankings: [
          {
            type: 'elimination',
            rank: 6,
            ranked_count: 6,
            elimination: {
              status: 'eliminated',
              eliminated_week: 3,
              minimum_meters: null,
              distance_meters: 0,
              week_ends_at: null,
            },
            provisional_points: null,
          },
        ],
      },
    });

    const [elimination] = within(screen.getByRole('link')).getAllByRole('listitem');
    expect(elimination).toHaveTextContent('Éliminé en semaine 3');
    expect(elimination).not.toHaveTextContent('sur 6');
  });

  it('shows no progress in week 1 of the elimination, only the rank', () => {
    renderCardIn('America/Montreal', {
      ...montreal,
      status: 'ongoing',
      my_week: {
        week: 1,
        week_ends_at: '2026-11-09T05:00:00Z',
        rankings: [
          {
            type: 'elimination',
            rank: 1,
            ranked_count: 3,
            elimination: {
              status: null,
              eliminated_week: null,
              minimum_meters: null,
              distance_meters: 4_000,
              week_ends_at: '2026-11-09T05:00:00Z',
            },
            provisional_points: null,
          },
        ],
      },
    });

    const [elimination] = within(screen.getByRole('link')).getAllByRole('listitem');
    expect(elimination).toHaveTextContent('Élimination1er sur 3');
    expect(elimination).not.toHaveTextContent('cette semaine');
  });
});
