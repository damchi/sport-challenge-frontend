import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse, type HttpResponseResolver } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { AdminCorrection } from '../../api/hooks/admin/useAdminCorrection';
import { mockAdminChallengeDetail, mockAdminChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminChallengeSheet } from './AdminChallengeSheet';

const first = mockAdminChallenges[0];
if (!first) throw new Error('Missing mocks');
const challenge = first;
const DELETED_AT = '2026-11-20T15:00:00Z';

interface Sent {
  method: string;
  path: string;
  body: { reason?: string; dry_run?: boolean };
}

/**
 * Serves the challenge, deleted or not, and its deletion and restore, which
 * change it once made (not previewed); `refuse` answers instead, if given.
 */
function serveChallenge(deleted: boolean, refuse?: Response) {
  const sent: Sent[] = [];
  let deletedAt: string | null = deleted ? DELETED_AT : null;
  const change =
    (next: string | null): HttpResponseResolver =>
    async ({ request }) => {
      const body = (await request.json()) as Sent['body'];
      sent.push({ method: request.method, path: new URL(request.url).pathname, body });
      if (refuse) return refuse;
      if (!body.dry_run) deletedAt = next;
      const answer: AdminCorrection = { dry_run: body.dry_run === true, challenges: [] };
      return HttpResponse.json(answer);
    };
  const base = '*/api/v1/admin/challenges/:challengeId';
  server.use(
    http.get(base, () =>
      HttpResponse.json({ ...mockAdminChallengeDetail(challenge), deleted_at: deletedAt }),
    ),
    http.delete(base, change(DELETED_AT)),
    http.post(`${base}/restore`, change(null)),
  );
  return sent;
}

function renderSheet() {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [{ path: '/admin/challenges/:challengeId', element: <AdminChallengeSheet /> }],
    { initialEntries: [`/admin/challenges/${challenge.id}`] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

/** Gives the reason in the dialog, and confirms. */
function giveReason(dialog: HTMLElement, confirmLabel: string) {
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Motif' }), {
    target: { value: 'Demande du créateur' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel }));
}

const path = `/api/v1/admin/challenges/${challenge.id}`;

describe('AdminChallengeLifecycle', () => {
  it('offers the deletion of a challenge, not its restore', async () => {
    serveChallenge(false);
    renderSheet();

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Supprimer le défi' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer le défi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restaurer le défi' })).toBeNull();
  });

  it('deletes a challenge with a reason, in a danger dialog, then shows it deleted', async () => {
    const sent = serveChallenge(false);
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le défi' }));
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le défi ?' });
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer le défi' });
    expect(confirm).toHaveClass('bg-danger');
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    giveReason(dialog, 'Supprimer le défi');

    const status = await screen.findByText('« Défi 1 » est supprimé.');
    expect(status).toHaveAttribute('role', 'status');
    await waitFor(() => expect(status).toHaveFocus());
    expect(await screen.findByText('Supprimé le 20 nov. 2026, 10:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurer le défi' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    // No preview: the deletion is made at once.
    expect(sent).toEqual([
      { method: 'DELETE', path, body: { reason: 'Demande du créateur', dry_run: false } },
    ]);
  });

  it('says in the dialog why a deletion was refused', async () => {
    serveChallenge(
      false,
      HttpResponse.json({ code: 'challenge_not_found', message: 'gone' }, { status: 404 }),
    );
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le défi' }));
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le défi ?' });
    giveReason(dialog, 'Supprimer le défi');

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(within(dialog).queryByText('gone')).toBeNull();
  });

  it('cancels a deletion: nothing is sent', async () => {
    const sent = serveChallenge(false);
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le défi' }));
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le défi ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Supprimer le défi' })).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('says by its button why the preview of a restore was refused', async () => {
    serveChallenge(
      true,
      HttpResponse.json({ code: 'challenge_not_found', message: 'gone' }, { status: 404 }),
    );
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Restaurer le défi' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('gone')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Aperçu des changements' })).toBeNull();
  });

  it('shows a deleted challenge with what its restore does, and no deletion', async () => {
    serveChallenge(true);
    renderSheet();

    expect(await screen.findByText('Supprimé le 20 nov. 2026, 10:00')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'À la restauration' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer le défi' })).toBeNull();
  });

  it('restores a deleted challenge: preview, reason, then the sheet again', async () => {
    const sent = serveChallenge(true);
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Restaurer le défi' }));
    await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });
    expect(screen.getAllByText('Restaurer « Défi 1 »')[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    giveReason(
      screen.getByRole('dialog', { name: 'Confirmer la restauration' }),
      'Restaurer le défi',
    );

    const status = await screen.findByText(
      '« Défi 1 » est restauré et ses classements sont recalculés.',
    );
    expect(status).toHaveAttribute('role', 'status');
    await waitFor(() => expect(status).toHaveFocus());
    expect(await screen.findByRole('button', { name: 'Supprimer le défi' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir la page du défi' })).toBeInTheDocument();
    expect(sent).toEqual([
      { method: 'POST', path: `${path}/restore`, body: { dry_run: true } },
      {
        method: 'POST',
        path: `${path}/restore`,
        body: { reason: 'Demande du créateur', dry_run: false },
      },
    ]);
  });
});
