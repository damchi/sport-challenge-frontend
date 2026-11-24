import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AdminCorrection } from '../../api/hooks/admin/useAdminCorrection';
import { mockAdminChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { RecomputeFlow } from './RecomputeFlow';

const challenge = mockAdminChallenges[0];
if (!challenge) throw new Error('No mock challenge');
const challengeId = challenge.id;

const user = (pseudo: string) => ({
  id: `id-${pseudo}`,
  pseudo,
  first_name: null,
  last_name: null,
  avatar: null,
});

function correction(dryRun: boolean): AdminCorrection {
  return {
    dry_run: dryRun,
    challenges: [
      {
        challenge_id: challengeId,
        before: null,
        after: {
          computed_at: '2026-11-24T12:00:00Z',
          categories: [
            {
              type: 'cumulative_time',
              ranked_count: 1,
              podium: null,
              entries: [
                {
                  rank: 1,
                  user: user('ami_1'),
                  value: 3600,
                  abandoned: false,
                  elimination: null,
                  provisional_points: null,
                },
              ],
              me: null,
              next_cursor: null,
            },
          ],
        },
        eliminations: [],
      },
    ],
  };
}

/** Answers the restore of the challenge as `answer` says, keeping each body sent. */
function serveRestore(
  answer: (body: { reason: string; dry_run?: boolean }) => Response | Promise<Response>,
) {
  const bodies: unknown[] = [];
  server.use(
    http.post('*/api/v1/admin/challenges/:challengeId/restore', async ({ request }) => {
      const body = (await request.json()) as { reason: string; dry_run?: boolean };
      bodies.push(body);
      return answer(body);
    }),
  );
  return bodies;
}

function renderFlow() {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  render(
    <AppProviders auth={auth}>
      <RecomputeFlow
        open
        title="Restaurer « Défi 1 » ?"
        summary="Le défi est de nouveau ouvert et ses classements sont recalculés."
        confirmLabel="Restaurer"
        send={async (client, body) => {
          const { data } = await client.POST('/api/v1/admin/challenges/{challengeId}/restore', {
            params: { path: { challengeId } },
            body,
          });
          return data;
        }}
        onDone={onDone}
        onCancel={onCancel}
      />
    </AppProviders>,
  );
  return { onDone, onCancel };
}

function giveReason(reason: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Motif' }), { target: { value: reason } });
  fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));
}

/** The preview, once it shows the ranking of the challenge (its title read). */
async function previewDialog() {
  const table = await screen.findByRole('region', { name: 'Défi 1 · Temps cumulé' });
  const dialog = table.closest('dialog');
  if (!dialog) throw new Error('No preview dialog');
  return dialog;
}

describe('RecomputeFlow', () => {
  it('asks the reason, previews with dry_run, then makes the change with the same reason', async () => {
    const bodies = serveRestore((body) => HttpResponse.json(correction(body.dry_run === true)));
    const { onDone } = renderFlow();

    giveReason('Supprimé par erreur');

    const preview = await previewDialog();
    expect(preview).toHaveAccessibleDescription(
      "Voici ce que la modification changerait. Rien n'est encore enregistré.",
    );
    expect(
      within(preview).getByRole('region', { name: 'Défi 1 · Temps cumulé' }),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ reason: 'Supprimé par erreur', dry_run: true }]);
    expect(within(preview).getByRole('button', { name: 'Annuler' })).toHaveFocus();

    fireEvent.click(within(preview).getByRole('button', { name: 'Restaurer' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(correction(false)));
    expect(bodies).toEqual([
      { reason: 'Supprimé par erreur', dry_run: true },
      { reason: 'Supprimé par erreur', dry_run: false },
    ]);
  });

  it('sends nothing more once cancelled at the preview', async () => {
    const bodies = serveRestore((body) => HttpResponse.json(correction(body.dry_run === true)));
    const { onCancel, onDone } = renderFlow();

    giveReason('Supprimé par erreur');
    const preview = await previewDialog();
    fireEvent.click(within(preview).getByRole('button', { name: 'Annuler' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(bodies).toHaveLength(1);
  });

  it('keeps the preview open while the confirmed change is sent', async () => {
    let release: () => void = () => undefined;
    const sent = new Promise<void>((resolve) => {
      release = resolve;
    });
    serveRestore((body) => {
      if (body.dry_run) return HttpResponse.json(correction(true));
      return sent.then(() => HttpResponse.json(correction(false)));
    });
    const { onCancel, onDone } = renderFlow();

    giveReason('Supprimé par erreur');
    const preview = await previewDialog();
    fireEvent.click(within(preview).getByRole('button', { name: 'Restaurer' }));
    const cancel = within(preview).getByRole('button', { name: 'Annuler' });
    await waitFor(() => expect(cancel).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(cancel);
    expect(onCancel).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('says why the preview is refused, with the reason dialog still open', async () => {
    serveRestore(() =>
      HttpResponse.json(
        { error: { code: 'challenge_not_found', message: 'Challenge not found' } },
        { status: 404 },
      ),
    );
    renderFlow();

    giveReason('Supprimé par erreur');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce défi n'existe pas ou tu n'y as pas accès.",
    );
    expect(screen.getByRole('textbox', { name: 'Motif' })).toBeInTheDocument();
  });

  it('says why the change is refused after the preview, the preview kept', async () => {
    serveRestore((body) =>
      body.dry_run
        ? HttpResponse.json(correction(true))
        : HttpResponse.json(
            { error: { code: 'challenge_not_found', message: 'Challenge not found' } },
            { status: 404 },
          ),
    );
    const { onDone } = renderFlow();

    giveReason('Supprimé par erreur');
    const preview = await previewDialog();
    fireEvent.click(within(preview).getByRole('button', { name: 'Restaurer' }));

    expect(await within(preview).findByRole('alert')).toHaveTextContent(
      "Ce défi n'existe pas ou tu n'y as pas accès.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });
});
