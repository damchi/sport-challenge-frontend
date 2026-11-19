import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockMe } from '../mocks/handlers';
import { server } from '../mocks/server';
import { AppProviders } from '../test/AppProviders';
import { createFakeAuth } from '../test/fakeAuth';
import { ProfileGate } from './ProfileGate';

function renderGate() {
  const router = createMemoryRouter(
    [{ element: <ProfileGate />, children: [{ path: '*', element: <p>app page</p> }] }],
    { initialEntries: ['/'] },
  );
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('ProfileGate', () => {
  it('announces the profile loading, then opens the page', async () => {
    renderGate();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de ton profil…');
    expect(await screen.findByText('app page')).toBeInTheDocument();
  });

  it('shows a translated error and loads again on retry', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/me', () => {
        calls += 1;
        return calls === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json(mockMe);
      }),
    );
    renderGate();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('app page')).toBeInTheDocument();
  });
});
