import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { AdminCorrection } from '../../api/hooks/admin/useAdminCorrection';
import {
  mockActivities,
  mockAdminChallengeDetail,
  mockAdminChallenges,
  mockAdminUsers,
} from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminActivityEditor } from './AdminActivityEditor';

const [marie, , deleted] = mockAdminUsers;
const [first, second] = mockAdminChallenges;
// Ten days back: its week is locked in the account's challenges.
const locked = mockActivities[10];
if (!marie || !deleted || !first || !second || !locked) throw new Error('No mocks');

// Tuesday 24 November 2026, noon in Montréal, the zone of the account's challenges.
const NOW = new Date('2026-11-24T17:00:00Z');

interface Sent {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

/** The preview, or the change made: it touches the first two challenges. */
function correction(dryRun: boolean): AdminCorrection {
  const ranking = {
    computed_at: '2026-11-24T12:00:00Z',
    categories: [],
  };
  return {
    dry_run: dryRun,
    challenges: [first, second].map((challenge) => ({
      challenge_id: challenge?.id ?? '',
      title: challenge?.title ?? '',
      status: 'ongoing' as const,
      reference_sport: { before: 'run', after: 'run' },
      results: null,
      weeks: [],
      points: [],
      before: ranking,
      after: ranking,
      eliminations: [],
    })),
  };
}

/** Answers the admin's activity routes with `answer`, keeping each request. */
function serve(answer?: (sent: Sent) => Response | undefined) {
  const sent: Sent[] = [];
  const handle = async ({ request }: { request: Request }) => {
    const entry = {
      method: request.method,
      path: new URL(request.url).pathname,
      body: (await request.json()) as Record<string, unknown>,
    };
    sent.push(entry);
    return answer?.(entry) ?? HttpResponse.json(correction(entry.body.dry_run === true));
  };
  server.use(
    http.post('*/api/v1/admin/users/:userId/activities', handle),
    http.patch('*/api/v1/admin/activities/:activityId', handle),
  );
  return sent;
}

function renderEditor(path: string) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  const editor = <AdminActivityEditor now={() => NOW} deviceTimeZone="Asia/Tokyo" />;
  const router = createMemoryRouter(
    [
      { path: '/admin/users/:userId/activities/new', element: editor },
      { path: '/admin/users/:userId/activities/:activityId', element: editor },
      { path: '/admin/users/:userId', element: <p>Fiche du compte</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}
const textbox = (name: string) => screen.getByRole('textbox', { name });

/** A run of 46 min 10 s and 8,2 km, Thursday 12 November at 18:30. */
async function fill() {
  fireEvent.click(await screen.findByRole('radio', { name: 'Course' }));
  type(screen.getByLabelText('Date'), '2026-11-12');
  type(textbox('Heure de début'), '18');
  type(textbox('Minutes de début'), '30');
  type(textbox('Minutes'), '46');
  type(textbox('Secondes'), '10');
  type(textbox('Distance en kilomètres'), '8,2');
}

/** From the preview, gives the reason and confirms in the dialog. */
async function confirm(dialogTitle: string, confirmLabel: string) {
  await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
  const dialog = screen.getByRole('dialog', { name: dialogTitle });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Motif' }), {
    target: { value: 'Oubli de saisie' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel }));
  return dialog;
}

// The device is in Tokyo: the account's zone (Montréal) is named.
beforeEach(() => {
  const options = Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone: 'Asia/Tokyo',
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  server.events.removeAllListeners();
});

describe('AdminActivityEditor', () => {
  it('adds an activity in the zone of the account, previewed then confirmed with the reason', async () => {
    const sent = serve();
    renderEditor(`/admin/users/${marie.id}/activities/new`);

    expect(
      await screen.findByRole('heading', { name: 'Ajouter une activité pour marie_92' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Mode admin. Les semaines jugées et les défis terminés ne bloquent pas la saisie.',
    );
    expect(screen.getByRole('link', { name: 'marie_92' })).toHaveAttribute(
      'href',
      `/admin/users/${marie.id}`,
    );
    await fill();
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    // Read in Montréal, not on the device (Tokyo); no reason for a preview.
    const activity = {
      sport_code: 'run',
      started_at: '2026-11-12T23:30:00.000Z',
      duration_seconds: 2770,
      distance_meters: 8200,
    };
    await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });
    expect(sent).toEqual([
      {
        method: 'POST',
        path: `/api/v1/admin/users/${marie.id}/activities`,
        body: { ...activity, dry_run: true },
      },
    ]);
    expect(
      screen.getByText(
        'Course · jeudi 12 nov., 18:30 (heure de l’Est nord-américain) · 0:46:10 · 8,2 km',
      ),
    ).toBeInTheDocument();

    // Each challenge the activity touches has its card.
    expect(await screen.findByRole('heading', { level: 3, name: 'Défi 1' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Défi 2' })).toBeInTheDocument();

    const dialog = await confirm("Confirmer l'ajout de l'activité", "Ajouter l'activité");
    // Every challenge the activity touches is named before confirming.
    expect(await within(dialog).findByText(/Défi 1/)).toBeInTheDocument();
    expect(within(dialog).getByText('2 défis recalculés :')).toBeInTheDocument();
    expect(await screen.findByText('Fiche du compte')).toBeInTheDocument();
    expect(sent[1]).toEqual({
      method: 'POST',
      path: `/api/v1/admin/users/${marie.id}/activities`,
      body: { ...activity, reason: 'Oubli de saisie', dry_run: false },
    });
  });

  it('changes an activity of a locked week, which the form opens as it is', async () => {
    const sent = serve();
    renderEditor(`/admin/users/${marie.id}/activities/${locked.id}`);

    expect(
      await screen.findByRole('heading', { name: 'Modifier une activité de marie_92' }),
    ).toBeInTheDocument();
    // 9 November, 7:30 in Montréal: no lock stops the admin.
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-09');
    expect(textbox('Heure de début')).toHaveValue('07');
    expect(screen.queryByText(/semaine terminée/)).not.toBeInTheDocument();
    type(textbox('Minutes'), '50');
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    await confirm("Confirmer la modification de l'activité", 'Enregistrer la modification');
    expect(await screen.findByText('Fiche du compte')).toBeInTheDocument();
    expect(sent.map(({ method, path, body }) => [method, path, body.dry_run])).toEqual([
      ['PATCH', `/api/v1/admin/activities/${locked.id}`, true],
      ['PATCH', `/api/v1/admin/activities/${locked.id}`, false],
    ]);
    expect(sent[1]?.body).toMatchObject({
      started_at: locked.started_at,
      duration_seconds: 3000,
      reason: 'Oubli de saisie',
    });
  });

  it('says the refusal of the preview in the admin words, the entry kept', async () => {
    serve(() =>
      HttpResponse.json(
        { error: { code: 'activity_overlap', message: 'Overlap' } },
        { status: 422 },
      ),
    );
    renderEditor(`/admin/users/${marie.id}/activities/new`);
    await fill();
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette activité chevauche une autre activité de ce compte.',
    );
    expect(textbox('Minutes')).toHaveValue('46');
  });

  it('comes back from the preview to the entry sent', async () => {
    serve();
    renderEditor(`/admin/users/${marie.id}/activities/new`);
    await fill();
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier la saisie' }));

    expect(await screen.findByRole('radio', { name: 'Course' })).toBeChecked();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-12');
    expect(textbox('Minutes')).toHaveValue('46');
    expect(textbox('Distance en kilomètres')).toHaveValue('8,2');
  });

  it('says so for an activity the account does not have', async () => {
    renderEditor(`/admin/users/${marie.id}/activities/00000000-0000-4000-8000-000000000999`);
    expect(
      await screen.findByText(
        "Cette activité n'existe plus : elle a peut-être été supprimée entre-temps.",
      ),
    ).toBeInTheDocument();
  });

  it('offers no entry for a deleted account', async () => {
    renderEditor(`/admin/users/${deleted.id}/activities/new`);
    expect(
      await screen.findByText('Ce compte est supprimé : ses activités sont effacées.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
  });
  it("reads the start on the device when the account's ongoing challenges share no zone", async () => {
    server.use(
      http.get('*/api/v1/admin/challenges/:challengeId', ({ params }) => {
        const summary = mockAdminChallenges.find(
          (challenge) => challenge.id === params.challengeId,
        );
        if (!summary) return HttpResponse.json({}, { status: 404 });
        // Défi 5 and Défi 8 are ongoing, the account active in both.
        const timezone =
          summary.id === mockAdminChallenges[4]?.id ? 'Europe/Paris' : 'America/Montreal';
        return HttpResponse.json(mockAdminChallengeDetail({ ...summary, timezone }));
      }),
    );
    const sent = serve();
    renderEditor(`/admin/users/${marie.id}/activities/new`);
    await fill();
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    await screen.findByRole('heading', { level: 2, name: 'Aperçu des changements' });
    // 18:30 in Tokyo, the device given to the editor.
    expect(sent[0]?.body.started_at).toBe('2026-11-12T09:30:00.000Z');
  });

  it('says when the account cannot have an activity yet', async () => {
    serve(() =>
      HttpResponse.json(
        { error: { code: 'profile_incomplete', message: 'Incomplete' } },
        { status: 422 },
      ),
    );
    renderEditor(`/admin/users/${marie.id}/activities/new`);
    await fill();
    fireEvent.click(screen.getByRole('button', { name: "Voir l'aperçu" }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce compte n'a pas encore indiqué son prénom et son nom",
    );
  });
});
