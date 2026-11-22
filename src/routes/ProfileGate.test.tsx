import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockMe } from '../mocks/handlers';
import { server } from '../mocks/server';
import { AppProviders } from '../test/AppProviders';
import { createFakeAuth } from '../test/fakeAuth';
import { ProfileGate } from './ProfileGate';

type Entry = string | { pathname: string; state: unknown };

function renderGate(entry: Entry = '/') {
  const router = createMemoryRouter(
    [
      {
        element: <ProfileGate />,
        children: [
          { path: '/onboarding', element: <p>onboarding page</p> },
          { path: '*', element: <p>app page</p> },
        ],
      },
    ],
    { initialEntries: [entry] },
  );
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('ProfileGate', () => {
  // Unmount first: a mounted gate would apply its profile language again.
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('fr');
  });

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

  it('sends a complete profile away from /onboarding, back to the invitation it broke into', async () => {
    const router = renderGate({
      pathname: '/onboarding',
      state: { returnTo: '/invite#token-123' },
    });

    expect(await screen.findByText('app page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/invite');
    expect(router.state.location.hash).toBe('#token-123');
  });

  it.each([
    { returnTo: '/challenges/new' },
    { returnTo: '/challenges/42' },
    { returnTo: '/invitex#token-123' },
    { returnTo: '/invite/42' },
    { returnTo: 'https://evil.example/invite#token-123' },
    { returnTo: '//evil.example/invite' },
    { returnTo: '/.//evil.example/invite' },
    { returnTo: 42 },
    null,
  ])(
    'sends a complete profile away from /onboarding, to the home page, for the state %j',
    async (state) => {
      const router = renderGate({ pathname: '/onboarding', state });

      expect(await screen.findByText('app page')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
      expect(router.state.location.hash).toBe('');
    },
  );

  it('applies the language kept in the profile', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, language: 'en' })));
    renderGate();

    await waitFor(() => expect(i18n.language).toBe('en'));
  });

  it('keeps the current language when the profile has none', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, language: null })));
    renderGate();

    expect(await screen.findByText('app page')).toBeInTheDocument();
    expect(i18n.language).toBe('fr');
  });
});
