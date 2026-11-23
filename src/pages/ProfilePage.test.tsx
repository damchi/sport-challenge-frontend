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
  async function change(label: string, value: string) {
    const input = await screen.findByRole('textbox', { name: label });
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  }

  // One save button for the names and the pseudo.
  const save = () =>
    within(screen.getByRole('region', { name: 'Identité' })).getByRole('button', {
      name: 'Enregistrer',
    });

  it('heads the profile with the initials avatar, the names and the pseudo', async () => {
    server.use(
      http.get('*/api/v1/me', () =>
        HttpResponse.json({
          ...mockMe,
          pseudo: 'draffi',
          first_name: 'Damien Paul-Louis',
          last_name: 'Raffi',
        }),
      ),
    );
    renderProfile();

    expect(await screen.findByText('Damien Paul-Louis Raffi')).toBeInTheDocument();
    expect(screen.getByText('@draffi')).toBeInTheDocument();
    expect(screen.getByText('DR')).toHaveAttribute('aria-hidden', 'true');
  });

  it('heads a profile without pseudo with the names alone', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, pseudo: null })));
    renderProfile();

    expect(await screen.findByText('Marie Tremblay')).toBeInTheDocument();
    expect(screen.queryByText(/^@\w/)).not.toBeInTheDocument();
  });

  it('shows the preferences and the account', async () => {
    renderProfile();

    expect(await screen.findByRole('region', { name: 'Préférences' })).toBeInTheDocument();
    const account = within(screen.getByRole('region', { name: 'Compte' }));
    expect(account.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
    expect(account.getByRole('button', { name: 'Supprimer mon compte' })).toBeInTheDocument();
  });

  it('links to the activities', async () => {
    renderProfile();

    expect(await screen.findByRole('link', { name: 'Mes activités' })).toHaveAttribute(
      'href',
      '/activities',
    );
  });

  it('shows the names to change and the e-mail address read-only', async () => {
    renderProfile();
    const section = await identity();

    expect(section.getByLabelText('Prénom')).toHaveValue('Marie');
    expect(section.getByLabelText('Nom')).toHaveValue('Tremblay');
    expect(section.getByText('Adresse courriel').nextElementSibling).toHaveTextContent(
      'marie@example.com',
    );
    expect(section.queryByDisplayValue('marie@example.com')).not.toBeInTheDocument();
  });

  it('says an e-mail the server does not have is missing', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, email: null })));
    renderProfile();
    const section = await identity();

    expect(section.getByText('Adresse courriel').nextElementSibling).toHaveTextContent(
      'Non renseigné',
    );
  });

  it('saves the names and the pseudo together, in one request', async () => {
    const sent: unknown[] = [];
    server.use(
      http.patch('*/api/v1/me', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ ...mockMe, first_name: 'Marie-Ève', pseudo: 'jean.luc' });
      }),
    );
    renderProfile();

    await change('Prénom', 'Marie-Ève');
    await change('Pseudo (facultatif)', 'jean.luc');
    fireEvent.click(save());

    expect(await screen.findByText('Profil enregistré.')).toHaveAttribute('role', 'status');
    expect(sent).toEqual([{ first_name: 'Marie-Ève', pseudo: 'jean.luc' }]);
  });

  describe('names', () => {
    it('changes the first and last name', async () => {
      let sent: unknown;
      server.use(
        http.patch('*/api/v1/me', async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json({ ...mockMe, first_name: 'Marie-Ève', last_name: 'Gagnon' });
        }),
      );
      renderProfile();

      await screen.findByLabelText('Prénom');
      expect(save()).toBeDisabled();
      await change('Prénom', ' Marie-Ève ');
      await change('Nom', 'Gagnon');
      fireEvent.click(save());

      expect(await screen.findByText('Profil enregistré.')).toHaveAttribute('role', 'status');
      expect(sent).toEqual({ first_name: 'Marie-Ève', last_name: 'Gagnon' });
    });

    it('keeps them required', async () => {
      renderProfile();

      await change('Nom', '');

      expect(await screen.findByRole('alert')).toHaveTextContent('Ce champ est obligatoire.');
      expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows a name the server refuses under its field', async () => {
      server.use(
        http.patch('*/api/v1/me', () =>
          HttpResponse.json(
            {
              error: {
                code: 'validation_failed',
                message: 'bad',
                params: { fields: 'first_name' },
              },
            },
            { status: 400 },
          ),
        ),
      );
      renderProfile();

      await change('Prénom', 'Mariette');
      fireEvent.click(save());

      expect(await screen.findByRole('alert')).toHaveTextContent("Ce nom n'est pas accepté.");
      expect(screen.getByLabelText('Prénom')).toHaveFocus();
    });
  });

  describe('pseudo', () => {
    it('changes the pseudo', async () => {
      let sent: unknown;
      server.use(
        http.patch('*/api/v1/me', async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json({ ...mockMe, pseudo: 'jean.luc' });
        }),
      );
      renderProfile();

      expect(await screen.findByRole('textbox', { name: 'Pseudo (facultatif)' })).toHaveValue(
        'marie_92',
      );
      expect(save()).toBeDisabled();
      await change('Pseudo (facultatif)', ' jean.luc ');
      fireEvent.click(save());

      expect(await screen.findByText('Profil enregistré.')).toHaveAttribute('role', 'status');
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

      await change('Pseudo (facultatif)', '  ');
      fireEvent.click(save());

      expect(await screen.findByText('Profil enregistré.')).toHaveAttribute('role', 'status');
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

      await change('Pseudo (facultatif)', 'jean.luc');
      fireEvent.click(save());

      expect(await screen.findByRole('alert')).toHaveTextContent('Ce pseudo est déjà pris.');
      expect(screen.getByRole('textbox', { name: 'Pseudo (facultatif)' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    it('is optional while there is none', async () => {
      server.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, pseudo: null })));
      renderProfile();

      await change('Pseudo (facultatif)', '');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(save()).toBeDisabled();
    });
  });
});
