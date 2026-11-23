import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { DeleteAccount } from './DeleteAccount';

function renderDeleteAccount() {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const onAccountDeleted = vi.fn();
  const router = createMemoryRouter([{ path: '/me', element: <DeleteAccount /> }], {
    initialEntries: ['/me'],
  });
  render(
    <AppProviders auth={auth} onAccountDeleted={onAccountDeleted}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { onAccountDeleted };
}

/** Counts the deletions sent, answering each one with `answer`. */
function deleteAnswers(answer: () => Response) {
  const sent = vi.fn();
  server.use(
    http.delete('*/api/v1/me', () => {
      sent();
      return answer();
    }),
  );
  return sent;
}

function openConfirmation() {
  fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
  return within(screen.getByRole('dialog', { name: 'Supprimer ton compte ?' }));
}

function confirmDeletion() {
  const dialog = openConfirmation();
  fireEvent.click(dialog.getByRole('checkbox', { name: "Je comprends que c'est définitif." }));
  fireEvent.click(dialog.getByRole('button', { name: 'Supprimer mon compte' }));
}

describe('DeleteAccount', () => {
  it('says what the deletion does and waits for the user to tick they understand', () => {
    const sent = deleteAnswers(() => new HttpResponse(null, { status: 204 }));
    renderDeleteAccount();

    const dialog = openConfirmation();
    const description = screen.getByRole('dialog').getAttribute('aria-describedby') ?? '';
    const consequences = within(document.getElementById(description) ?? document.body);
    expect(consequences.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Tu abandonnes tous tes défis, et tes activités sont effacées.',
      'Ton profil est anonymisé : prénom, nom, pseudo et courriel sont effacés.',
      'Ton compte de connexion est supprimé : tu ne pourras plus te connecter avec.',
      "C'est définitif : rien ne pourra être récupéré.",
    ]);
    const confirm = dialog.getByRole('button', { name: 'Supprimer mon compte' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(confirm);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(dialog.getByRole('button', { name: 'Garder mon compte' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sent).not.toHaveBeenCalled();
  });

  it('asks again from an unticked box each time it opens', () => {
    renderDeleteAccount();

    let dialog = openConfirmation();
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Garder mon compte' }));
    dialog = openConfirmation();

    expect(dialog.getByRole('checkbox')).not.toBeChecked();
  });

  it('ends the session once the account is deleted', async () => {
    const sent = deleteAnswers(() => new HttpResponse(null, { status: 204 }));
    const { onAccountDeleted } = renderDeleteAccount();

    confirmDeletion();

    await waitFor(() => expect(onAccountDeleted).toHaveBeenCalledTimes(1));
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it('ends the session when a retry finds the account already deleted', async () => {
    // The first attempt fails after the deletion; the retry finds it done.
    let attempts = 0;
    deleteAnswers(() =>
      ++attempts === 1
        ? HttpResponse.json(
            { error: { code: 'internal_error', message: 'Internal error' } },
            { status: 500 },
          )
        : HttpResponse.json(
            { error: { code: 'account_deleted', message: 'Account deleted' } },
            { status: 401 },
          ),
    );
    const { onAccountDeleted } = renderDeleteAccount();

    confirmDeletion();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible. Réessaie dans un instant.',
    );
    expect(onAccountDeleted).not.toHaveBeenCalled();
    confirmDeletion();

    await waitFor(() => expect(onAccountDeleted).toHaveBeenCalledTimes(1));
  });

  it('lists the challenges to hand over when the user is their last creator', async () => {
    const [first, second] = mockChallenges;
    deleteAnswers(() =>
      HttpResponse.json(
        {
          error: {
            code: 'last_creator',
            message: 'Last creator',
            params: { challenges: `${first?.id},${second?.id}` },
          },
        },
        { status: 422 },
      ),
    );
    const { onAccountDeleted } = renderDeleteAccount();

    confirmDeletion();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      "Tu es le dernier créateur d'un défi en cours. Ajoute un autre créateur ou supprime ce défi.",
    );
    expect(await within(alert).findByRole('link', { name: 'Défi 1' })).toHaveAttribute(
      'href',
      `/challenges/${first?.id}`,
    );
    expect(await within(alert).findByRole('link', { name: 'Défi 2' })).toHaveAttribute(
      'href',
      `/challenges/${second?.id}`,
    );
    expect(onAccountDeleted).not.toHaveBeenCalled();

    // A new attempt starts without the previous refusal.
    openConfirmation();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the network failed and lets the user try again', async () => {
    const sent = deleteAnswers(() => HttpResponse.error());
    const { onAccountDeleted } = renderDeleteAccount();

    confirmDeletion();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Connexion impossible. Vérifie ta connexion internet, puis réessaie.',
    );
    expect(onAccountDeleted).not.toHaveBeenCalled();
    confirmDeletion();
    await waitFor(() => expect(sent).toHaveBeenCalledTimes(2));
  });
});
