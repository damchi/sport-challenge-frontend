import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { AdminCorrection } from '../../api/hooks/admin/useAdminCorrection';
import { mockAdminChallengeDetail, mockAdminChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { failure, refreshAll } from '../../test/refresh';
import { createTestQueryClient } from '../../test/render';
import { AdminChallengeSettings } from './AdminChallengeSettings';

// Défi 1: upcoming, run, cumulative distance (ride ×0.3) and elimination (X = 2 km).
const first = mockAdminChallenges[0];
const deleted = mockAdminChallenges.at(-1);
if (!first || !deleted) throw new Error('No mock challenges');

const now = new Date('2026-11-24T12:00:00Z');
const timeZones = ['America/Montreal', 'Europe/Paris'];

function renderSettings(challengeId: string, queryClient = createTestQueryClient()) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const router = createMemoryRouter(
    [
      {
        path: '/admin/challenges/:challengeId/settings',
        element: <AdminChallengeSettings now={now} timeZones={timeZones} />,
      },
      { path: '/admin/challenges/:challengeId', element: <p>Fiche du défi</p> },
    ],
    { initialEntries: [`/admin/challenges/${challengeId}/settings`] },
  );
  render(
    <AppProviders auth={auth} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** Answers the change of settings as `answer` says, keeping each body sent. */
function servePatch(
  answer: (body: Record<string, unknown>) => Response = (body) =>
    HttpResponse.json<AdminCorrection>({ dry_run: body.dry_run === true, challenges: [] }),
) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.patch('*/api/v1/admin/challenges/:challengeId', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return answer(body);
    }),
  );
  return bodies;
}

async function stepField() {
  return screen.findByRole('spinbutton', { name: /Hausse minimale/ });
}

describe('AdminChallengeSettings', () => {
  it('fills every section with the settings of the challenge', async () => {
    renderSettings(first.id);

    expect(await stepField()).toHaveValue(2);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Modifier les réglages' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Défi 1' })).toHaveAttribute(
      'href',
      `/admin/challenges/${first.id}`,
    );
    expect(screen.getByRole('textbox', { name: 'Titre' })).toHaveValue('Défi 1');
    expect(screen.getByRole('textbox', { name: /Description/ })).toHaveValue(
      'Un mois pour courir ensemble.',
    );
    expect(screen.getByRole('radio', { name: 'Public' })).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Durée' })).toHaveValue(4);
    // The first day is past: an admin may keep it.
    expect(screen.getByLabelText('Premier jour')).toHaveValue('2026-11-02');
    expect(screen.getByRole('combobox', { name: /Fuseau/ })).toHaveValue('America/Montreal');
    expect(screen.getByRole('combobox', { name: 'Sport de référence' })).toHaveValue('run');
    expect(screen.getByRole('switch', { name: 'Distance cumulée' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Course avec élimination' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Grand prix' })).not.toBeChecked();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Ce défi est à venir, et ces réglages sont figés pour ses participants.',
    );
    expect(screen.getByRole('heading', { level: 3, name: '0 changement' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Les bornes ne changent pas : 2 à 52 semaines, coefficients de 0,1 à 2.',
    );
    expect(screen.queryByText(/^Modifié/)).not.toBeInTheDocument();
  });

  it('shows the calendar of a challenge whose first day is past', async () => {
    renderSettings(first.id);

    const calendar = await screen.findByRole('region', { name: 'Calendrier du défi' });
    expect(calendar).toHaveTextContent(
      'Du lundi 2 novembre 2026 au dimanche 29 novembre 2026 inclus.',
    );
    expect(calendar).toHaveTextContent('heure de l’Est nord-américain');
    const weeks = within(calendar).getAllByRole('listitem');
    expect(weeks).toHaveLength(4);
    expect(within(weeks[0] as HTMLElement).getByText('Semaine 1')).toBeInTheDocument();
    expect(within(weeks[0] as HTMLElement).getByText('2 nov. – 8 nov.')).toBeInTheDocument();
  });

  it('lists each change, with what it was beside the field', async () => {
    renderSettings(first.id);

    fireEvent.change(await stepField(), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Privé' }));

    const changes = screen
      .getByRole('heading', { level: 3, name: '2 changements' })
      .closest('section');
    if (!changes) throw new Error('No changes');
    const values = within(changes).getAllByRole('definition');
    expect(
      within(changes)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Visibilité', "Hausse minimale d'une semaine à l'autre"]);
    expect(values[0]).toHaveTextContent(/^Public →\s*devient Privé$/);
    expect(values[1]).toHaveTextContent(/^2\skm →\s*devient 3\skm$/);
    expect(screen.getByText(/^Modifié · avant : 2\skm$/)).toBeInTheDocument();
    expect(screen.getByText('Modifié · avant : Public')).toBeInTheDocument();
  });

  it('ticks and unticks the fastest run among the criteria of the grand prix', async () => {
    renderSettings(first.id);

    await stepField();
    fireEvent.click(screen.getByRole('switch', { name: 'Grand prix' }));
    const fastestRun = screen.getByRole('checkbox', { name: 'Sortie course la plus rapide' });
    fireEvent.click(fastestRun);
    expect(fastestRun).toBeChecked();
    fireEvent.click(fastestRun);
    expect(fastestRun).not.toBeChecked();
  });

  it('previews the change, then makes it with the reason', async () => {
    const bodies = servePatch();
    const router = renderSettings(first.id);

    fireEvent.change(await stepField(), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });
    const categories = {
      cumulative_distance: {},
      elimination: { step_meters: 3000 },
    };
    expect(bodies).toEqual([{ categories, dry_run: true }]);
    expect(screen.getByText('Modifier les réglages de « Défi 1 »')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirmer la modification des réglages' });
    // The distances keep their non-breaking space.
    expect(dialog).toHaveAccessibleDescription(
      /^Modifier les réglages de « Défi 1 » : Hausse minimale d'une semaine à l'autre : 2\skm → 3\skm$/,
    );
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Motif' }), {
      target: { value: 'Mauvais incrément à la création' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer la modification' }));

    expect(await screen.findByText('Fiche du défi')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/admin/challenges/${first.id}`);
    expect(bodies[1]).toEqual({
      categories,
      reason: 'Mauvais incrément à la création',
      dry_run: false,
    });
  });

  it('keeps the fields when going back from the preview', async () => {
    servePatch();
    renderSettings(first.id);

    fireEvent.change(await stepField(), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier la saisie' }));

    expect(await stepField()).toHaveValue(3);
    expect(screen.getByRole('heading', { level: 3, name: '1 changement' })).toBeInTheDocument();
  });

  it('asks before leaving changed settings, and stays with them', async () => {
    const router = renderSettings(first.id);

    fireEvent.change(await stepField(), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('link', { name: 'Annuler' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Quitter sans appliquer le changement ?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rester' }));

    await waitFor(() => expect(dialog).not.toBeVisible());
    expect(router.state.location.pathname).toBe(`/admin/challenges/${first.id}/settings`);
    expect(await stepField()).toHaveValue(3);

    fireEvent.click(screen.getByRole('link', { name: 'Défi 1' }));
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Quitter sans appliquer le changement ?' }),
      ).getByRole('button', { name: 'Quitter' }),
    );
    expect(await screen.findByText('Fiche du défi')).toBeInTheDocument();
  });

  it('leaves unchanged settings without asking', async () => {
    renderSettings(first.id);

    await stepField();
    fireEvent.click(screen.getByRole('link', { name: 'Annuler' }));

    expect(await screen.findByText('Fiche du défi')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before leaving the preview and the reason', async () => {
    servePatch();
    const router = renderSettings(first.id);

    fireEvent.change(await stepField(), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));
    await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });

    void router.navigate('/admin/challenges');
    const leave = await screen.findByRole('dialog', {
      name: 'Quitter sans appliquer le changement ?',
    });
    fireEvent.click(within(leave).getByRole('button', { name: 'Rester' }));
    await waitFor(() => expect(leave).not.toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    void router.navigate('/admin/challenges');
    expect(
      await screen.findByRole('dialog', { name: 'Quitter sans appliquer le changement ?' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(`/admin/challenges/${first.id}/settings`);
  });

  it('previews nothing while nothing changes', async () => {
    const bodies = servePatch();
    renderSettings(first.id);

    await stepField();
    const preview = screen.getByRole('button', { name: "Voir l'aperçu" });
    expect(preview).toHaveAttribute('aria-disabled', 'true');
    expect(preview).toHaveAccessibleDescription("Aucun changement pour l'instant.");
    fireEvent.click(preview);

    expect(
      screen.queryByRole('heading', { name: 'Aperçu des changements' }),
    ).not.toBeInTheDocument();
    expect(bodies).toEqual([]);

    fireEvent.change(await stepField(), { target: { value: '3' } });
    expect(preview).not.toHaveAttribute('aria-disabled');
  });

  it('sends nothing while a field is refused by the rules of the creation', async () => {
    const bodies = servePatch();
    renderSettings(first.id);

    fireEvent.change(await stepField(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    expect(
      await screen.findByText(
        'La hausse doit être entre 0,1 et 100 km, avec une décimale au plus.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Un champ est refusé : corrige-le, puis relance l'aperçu."),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('shows the field the server refuses', async () => {
    servePatch(() =>
      HttpResponse.json(
        { error: { code: 'validation_failed', message: 'invalid', params: { fields: 'title' } } },
        { status: 400 },
      ),
    );
    renderSettings(first.id);

    fireEvent.change(await screen.findByRole('textbox', { name: 'Titre' }), {
      target: { value: 'Défi renommé' },
    });
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Titre' })).toHaveAttribute(
        'aria-invalid',
        'true',
      ),
    );
    expect(
      screen.getByText("Valeur refusée. Vérifie-la, puis relance l'aperçu."),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Certaines informations sont invalides. Vérifie-les, puis réessaie.'),
    ).toBeInTheDocument();
  });

  it('asks to restore a deleted challenge first', async () => {
    renderSettings(deleted.id);

    expect(
      await screen.findByText('Ce défi est supprimé : restaure-le avant de changer ses réglages.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('says when the challenge does not exist', async () => {
    server.use(
      http.get('*/api/v1/admin/challenges/:challengeId', () =>
        HttpResponse.json(
          { error: { code: 'challenge_not_found', message: 'not found' } },
          { status: 404 },
        ),
      ),
    );
    renderSettings('00000000-0000-4000-8000-999999999999');

    expect(await screen.findByText(/introuvable|n'existe/)).toBeInTheDocument();
  });

  it('offers to retry when the challenge cannot be read', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/admin/challenges/:challengeId', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { code: 'internal_error', message: 'boom' } },
              { status: 500 },
            )
          : HttpResponse.json(mockAdminChallengeDetail(first));
      }),
    );
    renderSettings(first.id);

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await stepField()).toHaveValue(2);
  });

  it.each([500, 429] as const)(
    'keeps the fields and the changes when reading again fails (%i)',
    async (status) => {
      const queryClient = createTestQueryClient();
      renderSettings(first.id, queryClient);
      fireEvent.change(await stepField(), { target: { value: '3' } });

      server.use(
        http.get('*/api/v1/admin/challenges/:challengeId', () => failure(status)),
        http.get('*/api/v1/sports', () => failure(status)),
      );
      await refreshAll(queryClient);

      expect(await stepField()).toHaveValue(3);
      expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    },
  );

  it('says the challenge does not exist when reading it again answers so', async () => {
    const queryClient = createTestQueryClient();
    renderSettings(first.id, queryClient);
    await stepField();

    server.use(
      http.get('*/api/v1/admin/challenges/:challengeId', () =>
        HttpResponse.json(
          { error: { code: 'challenge_not_found', message: 'not found' } },
          { status: 404 },
        ),
      ),
    );
    await refreshAll(queryClient);

    expect(screen.getByText("Ce défi n'existe pas.")).toBeInTheDocument();
  });
});
