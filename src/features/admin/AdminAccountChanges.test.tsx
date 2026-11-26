import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { AdminUser } from '../../api/hooks/admin/useAdminUsers';
import { mockAdminUsers } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminUserSheet } from './AdminUserSheet';

const first = mockAdminUsers[0];
const gone = mockAdminUsers[2];
if (!first || !gone) throw new Error('No mock accounts');
const account: AdminUser = {
  ...first,
  pseudo: 'marcd',
  first_name: 'Marc',
  last_name: 'Dubois',
  state: 'active',
};

interface Sent {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

const path = `/api/v1/admin/users/${account.id}`;
const error = (status: number, code: string, params?: Record<string, string>) =>
  HttpResponse.json({ error: { code, message: 'raw server text', params } }, { status });

/**
 * Serves the account and its changes, which change it once made; `refuse`
 * answers instead, if given.
 */
function serveAccount(start: AdminUser = account, refuse?: () => Response) {
  const sent: Sent[] = [];
  let user = start;
  const base = '*/api/v1/admin/users/:userId';
  const keep = async (request: Request) => {
    const body = (await request.json()) as Record<string, unknown>;
    sent.push({ method: request.method, path: new URL(request.url).pathname, body });
    return body;
  };
  server.use(
    http.get(base, () => HttpResponse.json(user)),
    http.patch(base, async ({ request }) => {
      const body = await keep(request);
      if (refuse) return refuse();
      const update = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'reason'));
      user = { ...user, ...update };
      return HttpResponse.json(user);
    }),
    http.post(`${base}/block`, async ({ request }) => {
      await keep(request);
      if (refuse) return refuse();
      user = { ...user, state: 'blocked' };
      return HttpResponse.json(user);
    }),
    http.post(`${base}/unblock`, async ({ request }) => {
      await keep(request);
      if (refuse) return refuse();
      user = { ...user, state: 'active' };
      return HttpResponse.json(user);
    }),
    http.delete(base, async ({ request }) => {
      await keep(request);
      if (refuse) return refuse();
      user = {
        ...user,
        pseudo: null,
        first_name: null,
        last_name: null,
        email: null,
        state: 'deleted',
        deleted_at: '2026-11-25T15:00:00Z',
      };
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

function renderSheet(userId = account.id) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [{ path: '/admin/users/:userId', element: <AdminUserSheet /> }],
    { initialEntries: [`/admin/users/${userId}`] },
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
    target: { value: 'Demande du titulaire' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel }));
}

/** The message said once a change is made, focused. */
async function said(text: string) {
  const status = await screen.findByText(text);
  expect(status).toHaveAttribute('role', 'status');
  await waitFor(() => expect(status).toHaveFocus());
}

describe('AdminAccountChanges', () => {
  it('edits the profile: only what changed is sent, with the reason', async () => {
    const sent = serveAccount();
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le profil' }));
    const save = screen.getByRole('button', { name: 'Enregistrer' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Pseudo (facultatif)' }), {
      target: { value: 'marc_d' },
    });
    fireEvent.click(save);

    const dialog = await screen.findByRole('dialog', { name: 'Modifier le profil ?' });
    expect(within(dialog).getByText('Pseudo : marcd → marc_d')).toBeInTheDocument();
    giveReason(dialog, 'Enregistrer');

    await said('Le profil de marcd est modifié.');
    expect(await screen.findByRole('heading', { level: 2, name: 'marc_d' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Pseudo (facultatif)' })).toBeNull();
    expect(sent).toEqual([
      { method: 'PATCH', path, body: { pseudo: 'marc_d', reason: 'Demande du titulaire' } },
    ]);
  });

  it('opens the form on the first name, and gives the focus back on cancel', async () => {
    serveAccount();
    renderSheet();

    const edit = await screen.findByRole('button', { name: 'Modifier le profil' });
    fireEvent.click(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    const firstName = await screen.findByRole('textbox', { name: 'Prénom' });
    await waitFor(() => expect(firstName).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('textbox', { name: 'Prénom' })).toBeNull();
    expect(edit).toHaveFocus();
  });

  it('removes an emptied pseudo, with the rules of the profile', async () => {
    const sent = serveAccount();
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le profil' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Prénom' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Pseudo (facultatif)' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    // A name is required: nothing is asked until it is given.
    expect(await screen.findByText('Ce champ est obligatoire.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Prénom' }), {
      target: { value: 'Marc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    giveReason(await screen.findByRole('dialog', { name: 'Modifier le profil ?' }), 'Enregistrer');

    await said('Le profil de marcd est modifié.');
    expect(sent[0]?.body).toEqual({ pseudo: null, reason: 'Demande du titulaire' });
  });

  it('says by its field that a pseudo is taken', async () => {
    serveAccount(account, () => error(409, 'validation_failed', { fields: 'pseudo' }));
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le profil' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Pseudo (facultatif)' }), {
      target: { value: 'marie_92' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    giveReason(await screen.findByRole('dialog', { name: 'Modifier le profil ?' }), 'Enregistrer');

    const field = await screen.findByRole('textbox', { name: 'Pseudo (facultatif)' });
    expect(
      await screen.findByText('Ce pseudo est déjà pris. Essaie-en un autre.'),
    ).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('blocks an account, in a danger dialog, then offers to unblock it', async () => {
    const sent = serveAccount();
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Bloquer' }));
    const dialog = screen.getByRole('dialog', { name: 'Bloquer le compte ?' });
    expect(within(dialog).getByRole('button', { name: 'Bloquer le compte' })).toHaveClass(
      'bg-danger',
    );
    giveReason(dialog, 'Bloquer le compte');

    await said('Le compte de marcd est bloqué.');
    expect(await screen.findByRole('button', { name: 'Débloquer' })).toBeInTheDocument();
    expect(sent).toEqual([
      { method: 'POST', path: `${path}/block`, body: { reason: 'Demande du titulaire' } },
    ]);
  });

  it('unblocks a blocked account', async () => {
    const sent = serveAccount({ ...account, state: 'blocked' });
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Débloquer' }));
    const dialog = screen.getByRole('dialog', { name: 'Débloquer le compte ?' });
    expect(within(dialog).getByRole('button', { name: 'Débloquer le compte' })).not.toHaveClass(
      'bg-danger',
    );
    giveReason(dialog, 'Débloquer le compte');

    await said('Le compte de marcd est débloqué.');
    expect(await screen.findByRole('button', { name: 'Bloquer' })).toBeInTheDocument();
    expect(sent[0]?.path).toBe(`${path}/unblock`);
  });

  it('says in the dialog that an admin cannot block their own account', async () => {
    serveAccount(account, () => error(403, 'forbidden'));
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Bloquer' }));
    const dialog = screen.getByRole('dialog', { name: 'Bloquer le compte ?' });
    giveReason(dialog, 'Bloquer le compte');

    expect(
      await within(dialog).findByText('Tu ne peux pas bloquer ton propre compte.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText('raw server text')).toBeNull();
  });

  it('says a refused deletion in general words, not those of a block', async () => {
    serveAccount(account, () => error(403, 'forbidden'));
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le compte' }));
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le compte ?' });
    giveReason(dialog, 'Supprimer le compte');

    expect(
      await within(dialog).findByText('Tu ne peux pas faire ce changement sur ce compte.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText('Tu ne peux pas bloquer ton propre compte.')).toBeNull();
  });

  it('deletes an account, in a danger dialog: it then changes no more', async () => {
    const sent = serveAccount();
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le compte' }));
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le compte ?' });
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer le compte' });
    expect(confirm).toHaveClass('bg-danger');
    giveReason(dialog, 'Supprimer le compte');

    await said('Le compte est supprimé.');
    expect(await screen.findByRole('heading', { level: 2, name: 'Compte supprimé' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Modifier le profil' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bloquer' })).toBeNull();
    expect(sent).toEqual([{ method: 'DELETE', path, body: { reason: 'Demande du titulaire' } }]);
  });

  it('says why the last creator of a challenge cannot be deleted', async () => {
    serveAccount(account, () =>
      error(422, 'last_creator', { challenges: '30000000-0000-4000-8000-000000000001' }),
    );
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le compte' }));
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le compte ?' });
    giveReason(dialog, 'Supprimer le compte');

    expect(
      await within(dialog).findByText(
        "Ce compte est le dernier créateur d'un défi en cours : nomme d'abord un autre créateur, ou supprime le défi.",
      ),
    ).toBeInTheDocument();
  });

  it('offers no change for a deleted account', async () => {
    renderSheet(gone.id);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Compte supprimé' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier le profil' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bloquer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Supprimer le compte' })).toBeNull();
  });
});
