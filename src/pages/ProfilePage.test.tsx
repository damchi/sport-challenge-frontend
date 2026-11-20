import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockMe } from '../mocks/handlers';
import { server } from '../mocks/server';
import { ProfileGate } from '../routes/ProfileGate';
import { AppProviders } from '../test/AppProviders';
import { createFakeAuth } from '../test/fakeAuth';
import { ProfilePage } from './ProfilePage';

function renderProfile() {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [{ element: <ProfileGate />, children: [{ path: '/me', element: <ProfilePage /> }] }],
    { initialEntries: ['/me'] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

async function identity() {
  return within(await screen.findByRole('region', { name: 'Identité' }));
}

describe('ProfilePage', () => {
  it('shows the names and the e-mail as the server gives them, read-only', async () => {
    renderProfile();
    const section = await identity();

    expect(section.getByText('Prénom').nextElementSibling).toHaveTextContent('Marie');
    expect(section.getByText('Nom').nextElementSibling).toHaveTextContent('Tremblay');
    expect(section.getByText('E-mail').nextElementSibling).toHaveTextContent('marie@example.com');
    expect(section.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('says a value the server does not have is missing', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, email: null })));
    renderProfile();
    const section = await identity();

    expect(section.getByText('E-mail').nextElementSibling).toHaveTextContent('Non renseigné');
    expect(section.getByText('Prénom').nextElementSibling).toHaveTextContent('Marie');
  });

  describe('pseudo', () => {
    async function changePseudo(label: string, value: string) {
      const input = await screen.findByLabelText(label);
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    }

    it('changes the pseudo', async () => {
      let sent: unknown;
      server.use(
        http.patch('*/api/v1/me', async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json({ ...mockMe, pseudo: 'jean.luc' });
        }),
      );
      renderProfile();

      expect(await screen.findByLabelText('Pseudo (facultatif)')).toHaveValue('marie_92');
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
      await changePseudo('Pseudo (facultatif)', ' jean.luc ');
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(await screen.findByText('Pseudo enregistré.')).toHaveAttribute('role', 'status');
      expect(sent).toEqual({ pseudo: 'jean.luc' });
    });

    it('removes the pseudo when emptied', async () => {
      let sent: unknown;
      server.use(
        http.patch('*/api/v1/me', async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json({ ...mockMe, pseudo: null });
        }),
      );
      renderProfile();

      await changePseudo('Pseudo (facultatif)', '  ');
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(
        await screen.findByText('Pseudo retiré : les autres voient ton prénom et ton nom.'),
      ).toHaveAttribute('role', 'status');
      expect(sent).toEqual({ pseudo: null });
    });

    it('shows a taken pseudo under its field', async () => {
      server.use(
        http.patch('*/api/v1/me', () =>
          HttpResponse.json(
            {
              error: { code: 'validation_failed', message: 'taken', params: { fields: 'pseudo' } },
            },
            { status: 409 },
          ),
        ),
      );
      renderProfile();

      await changePseudo('Pseudo (facultatif)', 'jean.luc');
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Ce pseudo est déjà pris.');
      expect(screen.getByLabelText('Pseudo (facultatif)')).toHaveAttribute('aria-invalid', 'true');
    });

    it('is optional while there is none', async () => {
      server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, pseudo: null })));
      renderProfile();

      await changePseudo('Pseudo (facultatif)', '');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    });
  });
});
