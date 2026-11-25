import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { components } from '../../api/generated/schema';
import type { AdminCorrection } from '../../api/hooks/admin/useAdminCorrection';
import { mockAdminChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { RecomputeFlow } from './RecomputeFlow';

const challenge = mockAdminChallenges[0];
if (!challenge) throw new Error('No mock challenge');
const challengeId = challenge.id;

// What the change leaves as it was, besides the rankings and eliminations.
const unchanged = {
  title: 'Défi 1',
  status: 'ongoing' as const,
  reference_sport: { before: 'run', after: 'run' },
  results: null,
  weeks: [],
  points: [],
};

function correction(dryRun: boolean): AdminCorrection {
  const entry = (pseudo: string, rank: number, value: number) => ({
    rank,
    user: { id: `id-${pseudo}`, pseudo, first_name: null, last_name: null, avatar: null },
    value,
    abandoned: false,
    elimination: null,
    provisional_points: null,
  });
  const ranking = (entries: ReturnType<typeof entry>[]) => ({
    computed_at: '2026-11-24T12:00:00Z',
    categories: [
      {
        type: 'cumulative_time' as const,
        ranked_count: entries.length,
        podium: null,
        entries,
        me: null,
        next_cursor: null,
      },
    ],
  });
  return {
    dry_run: dryRun,
    challenges: [
      {
        challenge_id: challengeId,
        ...unchanged,
        before: ranking([entry('ami_1', 1, 7200), entry('ami_2', 2, 3600)]),
        after: ranking([entry('ami_2', 1, 9000), entry('ami_1', 2, 7200)]),
        eliminations: [],
      },
    ],
  };
}

interface Body {
  reason?: string;
  dry_run?: boolean;
}

/** Answers the restore of the challenge as `answer` says, keeping each body sent. */
function serveRestore(answer: (body: Body) => Response | Promise<Response>) {
  const bodies: Body[] = [];
  server.use(
    http.post('*/api/v1/admin/challenges/:challengeId/restore', async ({ request }) => {
      const body = (await request.json()) as Body;
      bodies.push(body);
      return answer(body);
    }),
  );
  return bodies;
}

function renderFlow() {
  const onDone = vi.fn();
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  render(
    <AppProviders auth={auth}>
      <RecomputeFlow
        change={{ title: 'Restaurer « Défi 1 »', details: 'Supprimé le 18 nov.' }}
        reasonTitle="Confirmer la restauration"
        confirmLabel="Confirmer"
        send={async (client, body) => {
          const { data } = await client.POST('/api/v1/admin/challenges/{challengeId}/restore', {
            params: { path: { challengeId } },
            // The contract still wants a reason on a preview, until SC-API-176
            // (damchi/sport-challenge-api#337) makes it optional.
            body: body as components['schemas']['AdminCorrectionReason'],
          });
          return data;
        }}
        onDone={onDone}
      >
        {({ showPreview, pending, error }) => (
          <>
            <button type="button" onClick={() => showPreview()} disabled={pending}>
              Voir l'aperçu
            </button>
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </RecomputeFlow>
    </AppProviders>,
  );
  return { onDone };
}

/** The preview page, once it shows the challenge's ranking (its title read). */
async function openPreview() {
  fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));
  await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });
  await screen.findByRole('heading', { level: 3, name: 'Défi 1' });
}

function giveReason(reason: string) {
  const dialog = screen.getByRole('dialog', { name: 'Confirmer la restauration' });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Motif' }), {
    target: { value: reason },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
}

describe('RecomputeFlow', () => {
  it('previews with dry_run and no reason, then makes the change with the reason', async () => {
    const bodies = serveRestore((body) => HttpResponse.json(correction(body.dry_run === true)));
    const { onDone } = renderFlow();

    await openPreview();

    expect(bodies).toEqual([{ dry_run: true }]);
    expect(screen.getByRole('heading', { level: 2, name: 'Aperçu des changements' })).toHaveFocus();
    expect(screen.getByText('Aperçu').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Restaurer « Défi 1 »')).toBeInTheDocument();
    expect(screen.getByText("Rien n'est enregistré avant ta confirmation.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirmer la restauration' });
    expect(dialog).toHaveAccessibleDescription(
      'Restaurer « Défi 1 » : Supprimé le 18 nov. 1 défi recalculé : Défi 1',
    );
    giveReason('Supprimé par erreur');

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(correction(false)));
    expect(bodies).toEqual([{ dry_run: true }, { reason: 'Supprimé par erreur', dry_run: false }]);
    // Made: nothing is sent again while the caller leaves the flow.
    expect(within(dialog).getByRole('button', { name: 'Confirmer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('goes back to the input from the preview, sending nothing more', async () => {
    const bodies = serveRestore((body) => HttpResponse.json(correction(body.dry_run === true)));
    renderFlow();

    await openPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la saisie' }));

    // The focus comes back to the fields, not lost on the page.
    expect(screen.getByRole('button', { name: "Voir l'aperçu" }).parentElement).toHaveFocus();
    await openPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));

    expect(screen.getByRole('button', { name: "Voir l'aperçu" })).toBeInTheDocument();
    expect(bodies).toEqual([{ dry_run: true }, { dry_run: true }]);
  });

  it('keeps the preview when the reason dialog is cancelled', async () => {
    const bodies = serveRestore((body) => HttpResponse.json(correction(body.dry_run === true)));
    const { onDone } = renderFlow();

    await openPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Aperçu des changements' })).toBeVisible();
    expect(onDone).not.toHaveBeenCalled();
    expect(bodies).toHaveLength(1);
  });

  it('keeps the reason dialog open while the change is sent', async () => {
    let release: () => void = () => undefined;
    const sent = new Promise<void>((resolve) => {
      release = resolve;
    });
    serveRestore((body) =>
      body.dry_run
        ? HttpResponse.json(correction(true))
        : sent.then(() => HttpResponse.json(correction(false))),
    );
    const { onDone } = renderFlow();

    await openPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    giveReason('Supprimé par erreur');
    const cancel = screen.getByRole('button', { name: 'Annuler' });
    await waitFor(() => expect(cancel).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(cancel);
    expect(screen.getByRole('dialog', { name: 'Confirmer la restauration' })).toBeInTheDocument();

    release();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('says why the preview is refused, on the input', async () => {
    serveRestore(() =>
      HttpResponse.json(
        { error: { code: 'challenge_not_found', message: 'Challenge not found' } },
        { status: 404 },
      ),
    );
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce défi n'existe pas ou tu n'y as pas accès.",
    );
    expect(screen.getByRole('button', { name: "Voir l'aperçu" })).toBeInTheDocument();
  });

  it('says why the change is refused, in the reason dialog', async () => {
    serveRestore((body) =>
      body.dry_run
        ? HttpResponse.json(correction(true))
        : HttpResponse.json(
            { error: { code: 'challenge_not_found', message: 'Challenge not found' } },
            { status: 404 },
          ),
    );
    const { onDone } = renderFlow();

    await openPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    giveReason('Supprimé par erreur');

    const dialog = screen.getByRole('dialog', { name: 'Confirmer la restauration' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Ce défi n'existe pas ou tu n'y as pas accès.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });
});
