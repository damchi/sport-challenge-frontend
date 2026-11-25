import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse, type HttpResponseResolver } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { AdminCorrection } from '../../api/hooks/admin/useAdminCorrection';
import {
  mockAdminChallengeDetail,
  mockAdminChallenges,
  mockAdminUsers,
  mockParticipants,
} from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminChallengeSheet } from './AdminChallengeSheet';

const challenge = mockAdminChallenges[0];
const deleted = mockAdminChallenges.at(-1);
const creator = mockParticipants[0];
const active = mockParticipants[1];
const abandoned = mockParticipants[3];
const account = mockAdminUsers[5];
if (!challenge || !deleted || !creator || !active || !abandoned || !account) {
  throw new Error('Missing mocks');
}

interface Body {
  user_id?: string;
  reason?: string;
  dry_run?: boolean;
}

interface Sent {
  method: string;
  path: string;
  body: Body;
}

/** What a change does: no ranking moves in these tests. */
const correction = (dryRun: boolean): AdminCorrection => ({ dry_run: dryRun, challenges: [] });

/**
 * Answers every admin change to the participants of the challenge as
 * `answer` says (a correction by default), keeping what was sent.
 */
function serveChanges(answer?: (sent: Sent) => Response | undefined) {
  const sent: Sent[] = [];
  const handle: HttpResponseResolver = async ({ request }) => {
    const text = await request.text();
    const body = (text ? JSON.parse(text) : {}) as Body;
    const entry = { method: request.method, path: new URL(request.url).pathname, body };
    sent.push(entry);
    return answer?.(entry) ?? HttpResponse.json(correction(body.dry_run === true));
  };
  const base = '*/api/v1/admin/challenges/:challengeId';
  server.use(
    http.post(`${base}/participants`, handle),
    http.delete(`${base}/participants/:userId`, handle),
    http.post(`${base}/participants/:userId/reinstate`, handle),
    http.put(`${base}/creators/:userId`, handle),
    http.delete(`${base}/creators/:userId`, handle),
  );
  return sent;
}

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

/** The table of the participants, once loaded. */
async function participantsTable() {
  return within(await screen.findByRole('region', { name: 'Participants' }));
}

/** Opens the changes of a participant, by the button of their row. */
async function openChanges(name: string) {
  const table = await participantsTable();
  fireEvent.click(table.getByRole('button', { name: `Modifications pour ${name}` }));
  return within(table.getByRole('group', { name: `Modifications pour ${name}` }));
}

/** From the preview, gives the reason and confirms in the dialog. */
async function confirm(dialogTitle: string, confirmLabel: string) {
  await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
  const dialog = screen.getByRole('dialog', { name: dialogTitle });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Motif' }), {
    target: { value: 'Demande du créateur' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel }));
  return dialog;
}

describe('AdminChallengeParticipants', () => {
  it('lists the participants: role, status and day of registration', async () => {
    renderSheet(challenge.id);

    const table = await participantsTable();
    const creatorRow = (await table.findByRole('rowheader', { name: 'marie_92' })).closest('tr');
    if (!creatorRow) throw new Error('No row');
    expect(within(creatorRow).getByText('Créateur')).toBeInTheDocument();
    expect(within(creatorRow).getByText('Actif')).toBeInTheDocument();
    const abandonedRow = table.getByRole('rowheader', { name: 'velo_max3' }).closest('tr');
    if (!abandonedRow) throw new Error('No row');
    expect(within(abandonedRow).getByText('Participant')).toBeInTheDocument();
    expect(within(abandonedRow).getByText('A abandonné ou exclu')).toBeInTheDocument();
  });

  it('lists no one in a deleted challenge, which changes no one', async () => {
    server.use(
      http.get('*/api/v1/admin/challenges/:challengeId', () =>
        HttpResponse.json(mockAdminChallengeDetail(deleted)),
      ),
    );
    renderSheet(deleted.id);

    await screen.findByRole('heading', { level: 2, name: deleted.title });
    expect(screen.queryByRole('heading', { level: 3, name: 'Participants' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajouter un participant' })).toBeNull();
  });

  it('excludes a participant: preview, reason, a danger confirmation, then the sheet again', async () => {
    const sent = serveChanges();
    renderSheet(challenge.id);

    const changes = await openChanges('jean.luc1');
    expect(changes.getByRole('button', { name: 'Nommer créateur' })).toBeInTheDocument();
    expect(changes.getByRole('link', { name: 'Voir sa fiche' })).toHaveAttribute(
      'href',
      `/admin/users/${active.user_id}`,
    );
    fireEvent.click(changes.getByRole('button', { name: 'Exclure' }));

    // The change, recalled by the preview (and the reason dialog, still closed).
    expect((await screen.findAllByText('Exclure jean.luc1 du défi'))[0]).toBeInTheDocument();
    const dialog = await confirm("Confirmer l'exclusion", 'Exclure du défi');
    expect(within(dialog).getByRole('button', { name: 'Exclure du défi' })).toHaveClass(
      'bg-danger',
    );

    expect(await screen.findByText('jean.luc1 a été exclu du défi.')).toHaveAttribute(
      'role',
      'status',
    );
    const path = `/api/v1/admin/challenges/${challenge.id}/participants/${active.user_id}`;
    expect(sent).toEqual([
      { method: 'DELETE', path, body: { dry_run: true } },
      { method: 'DELETE', path, body: { reason: 'Demande du créateur', dry_run: false } },
    ]);
  });

  it('reinstates one who abandoned, and makes them a creator', async () => {
    const sent = serveChanges();
    renderSheet(challenge.id);

    let changes = await openChanges('velo_max3');
    expect(changes.queryByRole('button', { name: 'Exclure' })).toBeNull();
    fireEvent.click(changes.getByRole('button', { name: 'Réintégrer dans le défi' }));
    await confirm('Confirmer la réintégration', 'Réintégrer');
    await screen.findByText('velo_max3 a été réintégré dans le défi.');
    await waitFor(() => expect(sent).toHaveLength(2));

    changes = await openChanges('velo_max3');
    fireEvent.click(changes.getByRole('button', { name: 'Nommer créateur' }));
    await confirm('Confirmer le nouveau créateur', 'Nommer créateur');
    await waitFor(() => expect(sent).toHaveLength(4));

    const base = `/api/v1/admin/challenges/${challenge.id}`;
    expect(sent.map(({ method, path }) => `${method} ${path}`)).toEqual([
      `POST ${base}/participants/${abandoned.user_id}/reinstate`,
      `POST ${base}/participants/${abandoned.user_id}/reinstate`,
      `PUT ${base}/creators/${abandoned.user_id}`,
      `PUT ${base}/creators/${abandoned.user_id}`,
    ]);
  });

  it('says, by its button, that the last creator keeps the role', async () => {
    const sent = serveChanges(() =>
      HttpResponse.json(
        { error: { code: 'last_creator', message: 'last creator', params: {} } },
        { status: 422 },
      ),
    );
    renderSheet(challenge.id);

    const changes = await openChanges('marie_92');
    // An excluded creator keeps the role: the help says so.
    expect(
      screen.getByText(/mais garde son rôle de créateur : retire-le à part/),
    ).toBeInTheDocument();
    fireEvent.click(changes.getByRole('button', { name: 'Retirer le rôle de créateur' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "C'est le dernier créateur du défi : nomme d'abord un autre créateur.",
    );
    // Still on the sheet: nothing to preview.
    expect(screen.queryByRole('heading', { level: 2, name: 'Aperçu des changements' })).toBeNull();
    expect(sent).toEqual([
      {
        method: 'DELETE',
        path: `/api/v1/admin/challenges/${challenge.id}/creators/${creator.user_id}`,
        body: { dry_run: true },
      },
    ]);
  });

  it('adds an account found by the search', async () => {
    const sent = serveChanges();
    renderSheet(challenge.id);

    await participantsTable();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un participant' }));
    const search = screen.getByRole('searchbox', {
      name: 'Rechercher le compte à ajouter par pseudo, nom ou e-mail',
    });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: 'ami_5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    const found = within(await screen.findByRole('list', { name: 'Comptes trouvés' }));
    expect(found.getByText('ami5@example.com')).toBeInTheDocument();
    fireEvent.click(found.getByRole('button', { name: 'Ajouter ami_5 au défi' }));
    expect((await screen.findAllByText('Ajouter ami_5 au défi'))[0]).toBeInTheDocument();
    await confirm("Confirmer l'ajout du participant", 'Ajouter au défi');

    expect(await screen.findByText('ami_5 a été ajouté au défi.')).toHaveFocus();
    const path = `/api/v1/admin/challenges/${challenge.id}/participants`;
    expect(sent).toEqual([
      { method: 'POST', path, body: { user_id: account.id, dry_run: true } },
      {
        method: 'POST',
        path,
        body: { user_id: account.id, reason: 'Demande du créateur', dry_run: false },
      },
    ]);
  });

  it('says why an account cannot be added, and keeps the search back from the preview', async () => {
    serveChanges(({ body }) =>
      body.user_id === mockAdminUsers[4]?.id
        ? HttpResponse.json(
            { error: { code: 'already_participant', message: 'already', params: {} } },
            { status: 409 },
          )
        : undefined,
    );
    renderSheet(challenge.id);

    await participantsTable();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un participant' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ami_' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    let found = within(await screen.findByRole('list', { name: 'Comptes trouvés' }));
    fireEvent.click(found.getByRole('button', { name: 'Ajouter ami_4 au défi' }));

    expect(await found.findByRole('alert')).toHaveTextContent(
      'Ce compte participe déjà à ce défi.',
    );

    fireEvent.click(found.getByRole('button', { name: 'Ajouter ami_5 au défi' }));
    await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));

    found = within(await screen.findByRole('list', { name: 'Comptes trouvés' }));
    expect(found.getByText('ami5@example.com')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('ami_');
  });
});
