import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockAdminChallengeDetail, mockAdminChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminChallengeSheet } from './AdminChallengeSheet';

const first = mockAdminChallenges[0];
const deleted = mockAdminChallenges.at(-1);
if (!first || !deleted) throw new Error('No mock challenges');

function renderSheet(challengeId: string) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [{ path: '/admin/challenges/:challengeId', element: <AdminChallengeSheet /> }],
    { initialEntries: [`/admin/challenges/${challengeId}`] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

/** A part of the sheet, found by its heading. */
function part(name: string) {
  const section = screen.getByRole('heading', { level: 3, name }).closest('section');
  if (!section) throw new Error(`No part ${name}`);
  return within(section);
}

describe('AdminChallengeSheet', () => {
  it('shows who made the challenge, its settings and the way to its page', async () => {
    renderSheet(first.id);

    expect(await screen.findByRole('heading', { level: 2, name: 'Défi 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir la page du défi' })).toHaveAttribute(
      'href',
      `/challenges/${first.id}`,
    );
    expect(screen.getByRole('link', { name: 'Modifier les réglages' })).toHaveAttribute(
      'href',
      `/admin/challenges/${first.id}/settings`,
    );
    expect(screen.getByRole('link', { name: 'Tous les défis' })).toHaveAttribute(
      'href',
      '/admin/challenges',
    );
    expect(screen.getByText('ami_1, ami_2')).toBeInTheDocument();
    expect(screen.getByText('20 oct. 2026, 10:00')).toBeInTheDocument();
    expect(screen.getByText('Pas encore figés')).toBeInTheDocument();
    const settings = part('Réglages');
    expect(settings.getByText('4 semaines')).toBeInTheDocument();
    expect(settings.getByText('Course avec élimination')).toBeInTheDocument();
  });

  it('shows the weeks, as the server judged them', async () => {
    renderSheet(first.id);

    const weeks = await screen.findByRole('table', { name: 'Semaines' });
    const [, week1, , week3] = within(weeks).getAllByRole('row');
    if (!week1 || !week3) throw new Error('No weeks');
    expect(within(week1).getByText('Verrouillée')).toBeInTheDocument();
    expect(within(week1).getByText('9 nov. 2026, 07:00')).toBeInTheDocument();
    expect(within(week3).getByText('Pas encore verrouillée')).toBeInTheDocument();
    expect(within(week3).getByText('Pas jugée')).toBeInTheDocument();
  });

  it('shows the eliminations, the invitation links and the last admin actions', async () => {
    renderSheet(first.id);
    await screen.findByRole('heading', { level: 2, name: 'Défi 1' });

    const elimination = part('Éliminations');
    expect(elimination.getByText('ami_3')).toBeInTheDocument();
    expect(elimination.getByText('3,5 km sur 4 km')).toBeInTheDocument();
    expect(part("Liens d'invitation").getByText('Expiré')).toBeInTheDocument();
    const actions = part('Dernières actions admin');
    expect(actions.getByText('Participant réintégré')).toBeInTheDocument();
    expect(actions.getByText('Motif : Séance oubliée, vue ensemble')).toBeInTheDocument();
    expect(actions.getByRole('link', { name: 'Tout le journal du défi' })).toHaveAttribute(
      'href',
      `/admin/journal?challenge_id=${first.id}`,
    );
  });

  it('says a link was revoked, and when, and leaves deleted accounts unnamed', async () => {
    const detail = mockAdminChallengeDetail(first);
    const unnamed = {
      id: '10000000-0000-4000-8000-000000000099',
      pseudo: null,
      first_name: null,
      last_name: null,
    };
    server.use(
      http.get('*/api/v1/admin/challenges/:challengeId', () =>
        HttpResponse.json({
          ...detail,
          creators: [unnamed],
          invitations: [
            {
              ...detail.invitations[0],
              invited_by: unnamed,
              revoked_at: '2026-10-25T14:00:00Z',
              status: 'revoked',
            },
          ],
        }),
      ),
    );
    renderSheet(first.id);

    const links = await screen.findByRole('table', { name: "Liens d'invitation" });
    expect(within(links).getByText('Révoqué')).toBeInTheDocument();
    expect(within(links).getByText('Révoqué le 25 oct. 2026, 10:00')).toBeInTheDocument();
    expect(within(links).getByText('Compte supprimé')).toBeInTheDocument();
    expect(screen.getAllByText('Compte supprimé')).toHaveLength(2);
  });

  it('says what a challenge has none of', async () => {
    server.use(
      http.get('*/api/v1/admin/challenges/:challengeId', () =>
        HttpResponse.json({
          ...mockAdminChallengeDetail(first),
          eliminations: [],
          invitations: [],
          recent_actions: [],
        }),
      ),
    );
    renderSheet(first.id);

    expect(await screen.findByText("Personne n'a été éliminé.")).toBeInTheDocument();
    expect(screen.getByText("Aucun lien d'invitation.")).toBeInTheDocument();
    expect(screen.getByText('Aucune action admin sur ce défi.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tout le journal du défi' })).not.toBeInTheDocument();
  });

  it('opens a deleted challenge, without the way to its closed page', async () => {
    renderSheet(deleted.id);

    expect(
      await screen.findByText("Supprimé le 20 nov. 2026, 10:00 : sa page n'est plus ouverte."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Voir la page du défi' })).not.toBeInTheDocument();
    // Restored first: the server refuses to change a deleted challenge.
    expect(screen.queryByRole('link', { name: 'Modifier les réglages' })).not.toBeInTheDocument();
  });

  it('says an unknown challenge does not exist', async () => {
    renderSheet('00000000-0000-4000-8000-999999999999');

    expect(await screen.findByText("Ce défi n'existe pas.")).toBeInTheDocument();
  });

  it('asks nothing of the server for an address that is no challenge', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderSheet('not-an-id');

    expect(await screen.findByText("Ce défi n'existe pas.")).toBeInTheDocument();
    expect(asked).toEqual([]);
    server.events.removeAllListeners();
  });

  it('shows the error and reloads on retry', async () => {
    server.use(
      http.get(
        '*/api/v1/admin/challenges/:challengeId',
        () =>
          HttpResponse.json(
            { error: { code: 'internal_error', message: 'boom' } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    renderSheet(first.id);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Défi 1' })).toBeInTheDocument();
  });
});
