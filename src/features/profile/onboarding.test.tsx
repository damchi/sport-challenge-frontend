import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockMe } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { OnboardingPage } from '../../pages/OnboardingPage';
import { ProfileGate } from '../../routes/ProfileGate';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';

const newProfile = {
  ...mockMe,
  pseudo: null,
  first_name: null,
  last_name: null,
  language: null,
  profile_complete: false,
};

// The profile gate and onboarding only, with a stand-in for any other page:
// the round trip is tested without the whole app.
const gatedRoutes = [
  {
    element: <ProfileGate />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '*', element: <h1>asked page</h1> },
    ],
  },
];

function renderApp(path: string) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(gatedRoutes, { initialEntries: [path] });
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

async function type(label: string, value: string) {
  const input = await screen.findByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

const typePseudo = (value: string) => type('Pseudo (facultatif)', value);

async function fillProfile(pseudo = 'marie_92') {
  await typePseudo(pseudo);
  await type('Prénom', 'Marie');
  await type('Nom', 'Tremblay');
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
    expect(screen.getByLabelText('Pseudo (facultatif)')).toHaveAttribute('aria-invalid', 'true');
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

    await fillProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce pseudo est déjà pris.');
  });

  it('shows a pseudo the server refuses as written under its field', async () => {
    server.use(
      http.patch('*/api/v1/me', () =>
        HttpResponse.json(
          { error: { code: 'validation_failed', message: 'bad', params: { fields: 'pseudo' } } },
          { status: 400 },
        ),
      ),
    );
    renderApp('/');

    await fillProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Ce pseudo n'est pas accepté.");
  });

  it('shows any other failure above the button', async () => {
    server.use(http.patch('*/api/v1/me', () => new HttpResponse(null, { status: 500 })));
    renderApp('/');

    await fillProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    expect(screen.getByLabelText('Pseudo (facultatif)')).not.toHaveAttribute('aria-invalid');
  });

  it('saves the profile and opens the home page, whatever page was asked for', async () => {
    let sent: unknown;
    // Like the API: once saved, the profile reads back complete (a refetch
    // after the redirect must not send the user back to onboarding).
    let saved: typeof mockMe | undefined;
    server.use(
      http.patch('*/api/v1/me', async ({ request }) => {
        sent = await request.json();
        saved = { ...mockMe, pseudo: 'jean.luc', first_name: 'Marie-Ève', last_name: 'N’Diaye' };
        return HttpResponse.json(saved);
      }),
      http.get('*/api/v1/me', () => HttpResponse.json(saved ?? newProfile)),
    );
    const router = renderApp('/challenges/new');

    await typePseudo('  jean.luc ');
    await type('Prénom', ' Marie-Ève ');
    await type('Nom', 'N’Diaye');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'asked page' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(sent).toEqual({
      pseudo: 'jean.luc',
      first_name: 'Marie-Ève',
      last_name: 'N’Diaye',
      language: 'fr',
    });
  });

  it('sends the names alone when the pseudo is left empty', async () => {
    let sent: unknown;
    let saved: typeof mockMe | undefined;
    server.use(
      http.patch('*/api/v1/me', async ({ request }) => {
        sent = await request.json();
        saved = { ...mockMe, pseudo: null };
        return HttpResponse.json(saved);
      }),
      http.get('*/api/v1/me', () => HttpResponse.json(saved ?? newProfile)),
    );
    renderApp('/');

    await type('Prénom', 'Marie');
    await type('Nom', 'Tremblay');
    await typePseudo('   ');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'asked page' }),
    ).toBeInTheDocument();
    expect(sent).toEqual({ first_name: 'Marie', last_name: 'Tremblay', language: 'fr' });
  });

  it('asks for the first and last name before sending', async () => {
    let sent = false;
    server.use(
      http.patch('*/api/v1/me', () => {
        sent = true;
        return HttpResponse.json(mockMe);
      }),
    );
    renderApp('/');

    await typePseudo('marie_92');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Ce champ est obligatoire.',
      'Ce champ est obligatoire.',
    ]);
    expect(screen.getByLabelText('Prénom')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true');
    expect(sent).toBe(false);
  });

  it('explains a name with other characters than letters', async () => {
    renderApp('/');

    await type('Prénom', 'Marie2');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Seulement des lettres, avec une espace, - ou ' entre les mots.",
    );
  });

  it('shows a name the server refuses under its field', async () => {
    server.use(
      http.patch('*/api/v1/me', () =>
        HttpResponse.json(
          { error: { code: 'validation_failed', message: 'bad', params: { fields: 'last_name' } } },
          { status: 400 },
        ),
      ),
    );
    renderApp('/');

    await fillProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Ce nom n'est pas accepté.");
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Prénom')).not.toHaveAttribute('aria-invalid');
  });

  it('marks every name the server refuses, the focus on the first', async () => {
    server.use(
      http.patch('*/api/v1/me', () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_failed',
              message: 'bad',
              params: { fields: 'first_name,last_name' },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderApp('/');

    await fillProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Prénom')).toHaveFocus();
  });

  it('sends a profile made before the names back to onboarding, its pseudo kept', async () => {
    server.use(
      http.get('*/api/v1/me', () =>
        HttpResponse.json({
          ...mockMe,
          first_name: null,
          last_name: null,
          profile_complete: false,
        }),
      ),
    );
    const router = renderApp('/me');

    expect(await screen.findByLabelText('Pseudo (facultatif)')).toHaveValue('marie_92');
    expect(router.state.location.pathname).toBe('/onboarding');
    expect(screen.getByLabelText('Prénom')).toHaveValue('');
    expect(screen.getByLabelText('Nom')).toHaveValue('');
  });
});
