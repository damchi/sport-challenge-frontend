import { render, screen, within } from '@testing-library/react';
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
});
