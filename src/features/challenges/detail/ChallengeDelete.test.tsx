import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { routes } from '../../../routes/routes';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;

// An ongoing challenge created by the user.
function answer(detail: Partial<ChallengeDetail> = {}) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () =>
      HttpResponse.json<ChallengeDetail>({
        ...mockChallengeDetail(summary),
        status: 'ongoing',
        my_role: 'creator',
        my_status: 'active',
        can_join: false,
        ...detail,
      }),
    ),
  );
}

let deletes = 0;
function deleteAnswers(response: () => Response | Promise<Response>) {
  server.use(
    http.delete('*/api/v1/challenges/:challengeId', () => {
      deletes += 1;
      return response();
    }),
  );
}

function renderAt(path = `/challenges/${id}/activities`) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** The delete button, in the header's menu, opened. */
const deleteButton = async () => {
  fireEvent.click(await screen.findByRole('button', { name: "Plus d'actions" }));
  return screen.getByRole('button', { name: 'Supprimer le défi' });
};

const openConfirmation = async () => {
  fireEvent.click(await deleteButton());
  return screen.getByRole('dialog', { name: `Supprimer « ${summary.title} » ?` });
};

beforeEach(() => {
  deletes = 0;
});

describe('ChallengeDelete', () => {
  it('is offered to creators only', async () => {
    answer({ my_role: 'participant' });
    renderAt();

    expect(
      await screen.findByRole('heading', { level: 1, name: summary.title }),
    ).toBeInTheDocument();
    // A participant's menu has abandoning only.
    fireEvent.click(screen.getByRole('button', { name: "Plus d'actions" }));
    expect(screen.getByRole('button', { name: 'Abandonner le défi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer le défi' })).not.toBeInTheDocument();
  });

  it('is still offered to a creator who abandoned', async () => {
    answer({ my_status: 'abandoned' });
    renderAt();

    expect(await deleteButton()).toBeInTheDocument();
  });

  it('warns that everything disappears and waits for the typed title', async () => {
    answer();
    deleteAnswers(() => new HttpResponse(null, { status: 204 }));
    renderAt();
    const dialog = await openConfirmation();

    expect(dialog).toHaveAccessibleDescription(
      "C'est définitif : le défi et ses classements disparaissent pour tous ses participants. Personne ne pourra plus l'ouvrir.",
    );
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer le défi' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(confirm);
    expect(deletes).toBe(0);

    const input = within(dialog).getByLabelText(
      `Pour confirmer, écris le titre du défi : « ${summary.title} »`,
    );
    fireEvent.change(input, { target: { value: 'Un autre titre' } });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deletes).toBe(0);
  });

  it.each([
    ['ongoing', 'ongoing'],
    ['finished', 'finished'],
  ] as const)('deletes an %s challenge and goes back home', async (_, status) => {
    answer({ status });
    deleteAnswers(() => new HttpResponse(null, { status: 204 }));
    const router = renderAt();
    const dialog = await openConfirmation();

    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: ` ${summary.title} ` },
    });
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer le défi' });
    expect(confirm).not.toHaveAttribute('aria-disabled');
    fireEvent.click(confirm);

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(deletes).toBe(1);
  });

  it('counts a challenge already deleted as deleted', async () => {
    answer();
    deleteAnswers(() =>
      HttpResponse.json(
        { error: { code: 'challenge_not_found', message: 'Not found' } },
        { status: 404 },
      ),
    );
    const router = renderAt();
    const dialog = await openConfirmation();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: summary.title } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer le défi' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('says the deletion is being sent once the dialog is closed', async () => {
    answer();
    let release: () => void = () => undefined;
    const sent = new Promise<void>((resolve) => {
      release = resolve;
    });
    deleteAnswers(async () => {
      await sent;
      return new HttpResponse(null, { status: 204 });
    });
    renderAt();
    const dialog = await openConfirmation();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: summary.title } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer le défi' }));

    // A creator's page has an empty status already, the edit's: found by its text.
    expect(await screen.findByText('Suppression en cours…')).toHaveAttribute('role', 'status');
    release();
  });

  it('says why the deletion was refused and stays on the challenge', async () => {
    answer();
    deleteAnswers(() =>
      HttpResponse.json({ error: { code: 'internal_error', message: 'Boom' } }, { status: 500 }),
    );
    const router = renderAt();
    const dialog = await openConfirmation();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: summary.title } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer le défi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible. Réessaie dans un instant.',
    );
    expect(router.state.location.pathname).toBe(`/challenges/${id}/activities`);
  });
});
