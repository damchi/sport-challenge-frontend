import { act, render, screen } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

function goOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

describe('OfflineBanner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('says a connection is required while offline, and goes once back online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    goOnline(false);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tu es hors ligne : une connexion internet est nécessaire.',
    );

    goOnline(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
