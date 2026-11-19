import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { mockChallenges } from '../../mocks/handlers';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ChallengeCard } from './ChallengeCard';

const montreal = mockChallenges[0];
if (!montreal) throw new Error('No mock challenge');

/** Renders the card on a device set to the given time zone. */
function renderCardIn(deviceTimeZone: string) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone: deviceTimeZone };
  });
  const router = createMemoryRouter([
    {
      path: '/',
      element: <ChallengeCard challenge={montreal as NonNullable<typeof montreal>} showStatus />,
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
});
