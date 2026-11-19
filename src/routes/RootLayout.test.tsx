import { fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useMemo, useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ApiError } from '../api/errors';
import { GlobalErrorContext } from '../lib/globalError';
import { routes } from './routes';

function AppWithError({ path }: { path: string }) {
  const [error, setError] = useState<unknown>();
  const [router] = useState(() => createMemoryRouter(routes, { initialEntries: [path] }));
  const dismiss = useCallback(() => setError(undefined), []);
  const value = useMemo(() => ({ error, dismiss }), [error, dismiss]);

  return (
    <GlobalErrorContext.Provider value={value}>
      <button type="button" onClick={() => setError(new ApiError('week_locked', 409))}>
        fail
      </button>
      <RouterProvider router={router} />
    </GlobalErrorContext.Provider>
  );
}

describe('RootLayout', () => {
  it('shows the global error banner and hides it on navigation', async () => {
    render(<AppWithError path="/does-not-exist" />);

    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: "Retour à l'accueil" }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sport Challenge' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes the banner with its button', () => {
    render(<AppWithError path="/" />);

    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
