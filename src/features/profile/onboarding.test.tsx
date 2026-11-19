import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockMe } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { routes } from '../../routes/routes';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';

const newProfile = { ...mockMe, pseudo: null, language: null, profile_complete: false };

function renderApp(path: string) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

async function typePseudo(value: string) {
  const input = await screen.findByLabelText('Pseudo');
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('profile onboarding', () => {
  beforeEach(() => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json(newProfile)));
  });

  it('sends an incomplete profile to /onboarding', async () => {
    const router = renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Bienvenue' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('explains an invalid pseudo once the field is left, then as it is typed', async () => {
    renderApp('/');

    await typePseudo('ab');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le pseudo doit faire de 3 à 20 caractères.',
    );

    await typePseudo('marie 92');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Seulement des lettres, des chiffres, _, . ou -.',
    );
    expect(screen.getByLabelText('Pseudo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a taken pseudo under its field', async () => {
    server.use(
      http.patch('*/api/v1/me', () =>
        HttpResponse.json(
          { error: { code: 'validation_failed', message: 'taken', params: { fields: 'pseudo' } } },
          { status: 409 },
        ),
      ),
    );
    renderApp('/');

    await typePseudo('marie_92');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce pseudo est déjà pris.');
  });

  it('saves the profile and opens the page first asked for', async () => {
    let sent: unknown;
    server.use(
      http.patch('*/api/v1/me', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...mockMe, pseudo: 'jean.luc', language: 'fr' });
      }),
    );
    const router = renderApp('/does-not-exist');

    await typePseudo('  jean.luc ');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    // Save, cache update and redirect: more than the default second under load.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/does-not-exist');
    expect(sent).toEqual({ pseudo: 'jean.luc', language: 'fr' });
  });
});
