import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
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
    // React logs the caught error; kept out of the test output.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary resetKey="/a">
        <Flaky />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: "Oups, cette page n'a pas pu s'afficher" }),
    ).toBeInTheDocument();

    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(screen.getByText('content')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('leaves the error page when its key changes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();

    broken = false;
    rerender(
      <ErrorBoundary resetKey="/b">
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('shows the error page of a page that fails as its key changes', () => {
    broken = false;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Flaky />
      </ErrorBoundary>,
    );

    broken = true;
    rerender(
      <ErrorBoundary resetKey="/b">
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('keeps what is below mounted, with its state, when its key changes', () => {
    let mounts = 0;
    function Counter() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        mounts += 1;
      }, []);
      return (
        <button type="button" onClick={() => setCount(count + 1)}>
          {`count ${count}`}
        </button>
      );
    }
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Counter />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'count 0' }));

    rerender(
      <ErrorBoundary resetKey="/b">
        <Counter />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'count 1' })).toBeInTheDocument();
    expect(mounts).toBe(1);
  });
});
