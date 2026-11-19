import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '../api/errors';
import { GlobalErrorBanner } from './GlobalErrorBanner';

describe('GlobalErrorBanner', () => {
  it('announces the translated message of an API error', () => {
    const error = new ApiError('rate_limited', 429, { retry_after: '30' });
    render(<GlobalErrorBanner error={error} onDismiss={() => undefined} />);

    // Testing Library reads the non-breaking space before "s" as a space.
    expect(screen.getByRole('alert')).toContainElement(
      screen.getByText('Trop de requêtes. Réessaie dans 30 s.'),
    );
  });

  it('falls back on the generic message for any other error', () => {
    render(<GlobalErrorBanner error={new Error('boom')} onDismiss={() => undefined} />);

    expect(screen.getByRole('alert')).toContainElement(
      screen.getByText('Une erreur est survenue. Réessaie.'),
    );
  });

  it('closes with a labelled button', () => {
    const onDismiss = vi.fn();
    render(<GlobalErrorBanner error={new Error('boom')} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fermer le message' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
