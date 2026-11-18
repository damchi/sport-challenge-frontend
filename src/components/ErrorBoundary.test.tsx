import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

let broken: boolean;

function Flaky() {
  if (broken) throw new Error('render failure');
  return <p>content</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    broken = true;
  });

  it('shows an error page and renders the page again on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: "Oups, cette page n'a pas pu s'afficher" }),
    ).toBeInTheDocument();

    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
