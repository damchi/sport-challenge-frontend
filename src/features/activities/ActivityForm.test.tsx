import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Activity, ActivityContribution, ActivityCreate } from '../../api/hooks/useActivities';
import type { components } from '../../api/generated/schema';
import { mockChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ActivityForm } from './ActivityForm';

type ChallengePage = components['schemas']['ChallengePage'];

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const challenge = found;

// Friday 20 November 2026, noon in Montréal, the time zone of the mock
// challenges.
const NOW = new Date('2026-11-20T17:00:00Z');
// 7:30 in Montréal.
const STARTED_AT = '2026-11-20T12:30:00.000Z';
const KEY = 'activity-key-1';

/** Keys as the form makes them: activity-key-1, activity-key-2... */
function keyMaker() {
  let count = 0;
  return () => {
    count += 1;
    return `activity-key-${count}`;
  };
}

function renderForm({ deviceTimeZone = 'Asia/Tokyo' }: { deviceTimeZone?: string } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/activities/new',
        element: (
          <ActivityForm
            now={() => NOW}
            deviceTimeZone={deviceTimeZone}
            newIdempotencyKey={keyMaker()}
          />
        ),
      },
      { path: '/', element: <p>Page d'accueil</p> },
      { path: '/activities', element: <p>Mes activités (page)</p> },
    ],
    { initialEntries: ['/activities/new'] },
  );
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

/** Answers the recording with `respond`, keeping each request's body and key. */
function recordWith(respond: () => Response | Promise<Response>) {
  const sent: { body: ActivityCreate; key: string | null }[] = [];
  server.use(
    http.post('*/api/v1/activities', async ({ request }) => {
      sent.push({
        body: (await request.json()) as ActivityCreate,
        key: request.headers.get('Idempotency-Key'),
      });
      return respond();
    }),
  );
  return sent;
}

/** The recorded activity, counting in these challenges. */
function recorded(contributions: ActivityContribution[] = []) {
  return HttpResponse.json<Activity>(
    {
      id: '00000000-0000-4000-8000-0000000000a1',
      sport_code: 'run',
      sport_label: null,
      started_at: STARTED_AT,
      duration_seconds: 2700,
      distance_meters: 8200,
      source: 'manual',
      speed_mps: 3.04,
      pace_seconds_per_km: 329,
      contributions,
      locked: false,
    },
    { status: 201 },
  );
}

/** What the activity brings to the challenge `title`. */
function contribution(id: string, title: string): ActivityContribution {
  return {
    challenge_id: id,
    challenge_title: title,
    distance_meters: 8200,
    duration_seconds: 2700,
  };
}

function refuse(code: string, status = 422, params: Record<string, string> = {}) {
  return recordWith(() =>
    HttpResponse.json({ error: { code, message: 'Refused', params } }, { status }),
  );
}

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

const startDate = () => screen.getByLabelText('Date');
const startTime = () => screen.getByLabelText('Heure');
const hours = () => screen.getByRole('textbox', { name: 'Heures' });
const minutes = () => screen.getByRole('textbox', { name: 'Minutes' });
const distance = () => screen.queryByRole('textbox', { name: 'Distance en kilomètres' });
const save = () => screen.getByRole('button', { name: /Enregistr/ });

/** Picks the sport named `name` among the chips, once they are shown. */
async function pick(name: string) {
  fireEvent.click(await screen.findByRole('radio', { name }));
}

/** Types the start's day and time. */
function typeStart(date: string, time: string) {
  type(startDate(), date);
  type(startTime(), time);
}

/** A run of 45 min and 8,2 km this morning, unless said otherwise. */
async function fill({ sport = 'Course', km = '8,2' }: { sport?: string; km?: string } = {}) {
  await pick(sport);
  typeStart('2026-11-20', '07:30');
  type(minutes(), '45');
  const field = distance();
  if (field && km) type(field, km);
}

describe('ActivityForm', () => {
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('offers the sports of the catalogue in the order of the mockups, "other" last', async () => {
    renderForm();
    const chips = within(await screen.findByRole('group', { name: 'Sport' }))
      .getAllByRole('radio')
      .map((chip) => chip.closest('label')?.textContent);
    expect(chips).toEqual([
      'Course',
      'Vélo',
      'Marche',
      'Randonnée',
      'Natation',
      'Aviron',
      'Roller',
      'Ski de fond',
      'Yoga',
      'Escalade',
      'Renforcement musculaire',
      'Autre',
    ]);
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0);
    expect(screen.queryByRole('textbox', { name: /vitesse|allure/i })).not.toBeInTheDocument();
    expect(startDate()).toHaveAttribute('type', 'date');
    expect(startDate()).toHaveAttribute('max', '2026-11-20');
    expect(startTime()).toHaveAttribute('type', 'time');
  });

  it('sums up the entry as it goes, without pace nor speed', async () => {
    renderForm();
    const summary = await screen.findByRole('region', { name: 'Résumé' });
    expect(summary).toHaveTextContent('Il se remplit au fil de ta saisie.');
    await fill();
    type(hours(), '1');

    const rows = within(summary)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(rows).toEqual([
      ['Sport', 'Course'],
      ['Début', 'vendredi 20 nov., 7:30'],
      ['Durée', '1:45:00'],
      ['Distance', '8,2\u202fkm'],
    ]);
    expect(summary).not.toHaveTextContent(/Allure|Vitesse/);

    // A sport without km has no distance; "other" shows its label.
    await pick('Yoga');
    expect(within(summary).queryByText('Distance')).not.toBeInTheDocument();
    await pick('Autre');
    type(screen.getByRole('textbox', { name: 'Quel sport ?' }), '  Padel ');
    expect(within(summary).getByText('Padel')).toBeInTheDocument();
  });

  it('asks before leaving a changed entry', async () => {
    renderForm();
    fireEvent.click(await screen.findByRole('link', { name: 'Annuler' }));
    // Nothing entered: it leaves at once.
    expect(await screen.findByText('Mes activités (page)')).toBeInTheDocument();
  });

  it('keeps a changed entry when leaving is called off', async () => {
    renderForm();
    await pick('Course');
    fireEvent.click(screen.getByRole('link', { name: 'Annuler' }));

    const dialog = await screen.findByRole('dialog', { name: 'Quitter la saisie ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuer la saisie' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('radio', { name: 'Course' })).toBeChecked();

    fireEvent.click(screen.getByRole('link', { name: 'Annuler' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Quitter' }),
    );
    expect(await screen.findByText('Mes activités (page)')).toBeInTheDocument();
  });

  /** The user's ongoing challenges, in these time zones. */
  function ongoingIn(...timeZones: string[]) {
    server.use(
      http.get('*/api/v1/challenges', () =>
        HttpResponse.json<ChallengePage>({
          items: timeZones.map((timezone, index) => ({
            ...challenge,
            id: `00000000-0000-4000-8000-00000000010${index}`,
            timezone,
            my_role: 'participant',
            my_status: 'active',
            status: 'ongoing',
          })),
          next_cursor: null,
          counts: { upcoming: 0, ongoing: timeZones.length, finished: 0 },
        }),
      ),
    );
  }

  it("reads the start in the time zone of the user's ongoing challenges", async () => {
    renderForm();
    expect(
      await screen.findByText(/^Date et heure de début, heure de l’Est nord-américain\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Fuseau horaire' })).not.toBeInTheDocument();
  });

  it("reads the start in the device's time zone without an ongoing challenge", async () => {
    ongoingIn();
    const sent = recordWith(() => recorded());
    renderForm({ deviceTimeZone: 'Europe/Paris' });
    expect(
      await screen.findByText(/^Date et heure de début, heure normale d’Europe centrale\./),
    ).toBeInTheDocument();
    // 18:00 in Paris.
    expect(startDate()).toHaveAttribute('max', '2026-11-20');
    await fill();
    fireEvent.click(save());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body.started_at).toBe('2026-11-20T06:30:00.000Z');
  });

  it("reads the start in the device's time zone when the challenges are in several", async () => {
    // A run in Montréal while taking part in a challenge there and one in Paris.
    ongoingIn('America/Toronto', 'Europe/Paris');
    const sent = recordWith(() => recorded());
    renderForm({ deviceTimeZone: 'America/Toronto' });
    expect(
      await screen.findByText(/^Date et heure de début, heure de l’Est nord-américain\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /fuseau/i })).not.toBeInTheDocument();
    await fill();
    fireEvent.click(save());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body.started_at).toBe(STARTED_AT);
  });

  it('reads every page of the ongoing challenges for their time zones', async () => {
    server.use(
      http.get('*/api/v1/challenges', ({ request }) => {
        const second = new URL(request.url).searchParams.get('cursor') === 'next';
        return HttpResponse.json<ChallengePage>({
          items: [
            {
              ...challenge,
              id: second
                ? '00000000-0000-4000-8000-000000000202'
                : '00000000-0000-4000-8000-000000000201',
              timezone: second ? 'Europe/Paris' : 'America/Toronto',
              my_role: 'participant',
              my_status: 'active',
              status: 'ongoing',
            },
          ],
          next_cursor: second ? null : 'next',
          counts: { upcoming: 0, ongoing: 2, finished: 0 },
        });
      }),
    );
    renderForm({ deviceTimeZone: 'Europe/Paris' });

    // Montréal on the first page, Paris on the second: the device's zone.
    expect(
      await screen.findByText(/^Date et heure de début, heure normale d’Europe centrale\./),
    ).toBeInTheDocument();
  });

  it('records the activity with its idempotency key, then says so', async () => {
    // The development mock answers as the server: 201 with the activity.
    const sent: { body: ActivityCreate; key: string | null }[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method !== 'POST' || !request.url.endsWith('/api/v1/activities')) return;
      void request
        .clone()
        .json()
        .then((body: ActivityCreate) => {
          sent.push({ body, key: request.headers.get('Idempotency-Key') });
        });
    });
    renderForm();
    await fill();
    fireEvent.click(save());

    // The development mock counts it in no challenge: a success all the same.
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Activité enregistrée.');
    expect(status).toHaveTextContent('Elle ne compte encore dans aucun défi.');
    expect(status).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(sent).toEqual([
      {
        key: KEY,
        body: {
          sport_code: 'run',
          started_at: STARTED_AT,
          duration_seconds: 2700,
          distance_meters: 8200,
        },
      },
    ]);
    expect(screen.getByRole('link', { name: 'Retour à mes activités' })).toHaveAttribute(
      'href',
      '/activities',
    );
  });

  it('says the challenge it counts in, with a link to its leaderboard', async () => {
    recordWith(() => recorded([contribution('c1', 'Novembre en mouvement')]));
    renderForm();
    await fill();
    fireEvent.click(save());

    expect(await screen.findByRole('status')).toHaveTextContent('Elle compte dans 1 défi :');
    expect(
      screen.getByRole('link', { name: /Novembre en mouvement.*Voir le classement/ }),
    ).toHaveAttribute('href', '/challenges/c1');
  });

  it('lists every challenge it counts in', async () => {
    recordWith(() =>
      recorded([contribution('c1', 'Novembre en mouvement'), contribution('c2', 'Course du midi')]),
    );
    renderForm();
    await fill();
    fireEvent.click(save());

    expect(await screen.findByRole('status')).toHaveTextContent('Elle compte dans 2 défis :');
    const links = within(screen.getByRole('list')).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/challenges/c1',
      '/challenges/c2',
    ]);
    expect(links[1]).toHaveTextContent('Course du midi');
  });

  it('keeps the outcome when the challenges cannot reload afterwards', async () => {
    recordWith(() => recorded([contribution('c1', 'Novembre en mouvement')]));
    renderForm();
    await fill();
    server.use(
      http.get('*/api/v1/challenges', () =>
        HttpResponse.json({ error: { code: 'internal_error', message: 'x' } }, { status: 500 }),
      ),
    );
    fireEvent.click(save());

    expect(await screen.findByRole('status')).toHaveTextContent('Elle compte dans 1 défi :');
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
  });

  it('says so at once, without waiting for the challenges to reload', async () => {
    recordWith(() => recorded([contribution('c1', 'Novembre en mouvement')]));
    renderForm();
    await fill();
    // The reload never answers.
    server.use(http.get('*/api/v1/challenges', () => new Promise<Response>(() => undefined)));
    fireEvent.click(save());

    expect(await screen.findByRole('status')).toHaveTextContent('Elle compte dans 1 défi :');
  });

  it('asks for the distance of a sport with km', async () => {
    const sent = recordWith(() => recorded());
    renderForm();
    await fill({ km: '' });
    expect(screen.getByText('obligatoire pour ce sport')).toBeInTheDocument();
    fireEvent.click(save());

    expect(await screen.findByText('Indique la distance.')).toBeInTheDocument();
    expect(distance()).toHaveAttribute('aria-invalid', 'true');
    expect(sent).toHaveLength(0);
  });

  it('shows no distance for a sport without km, and sends none', async () => {
    const sent = recordWith(() => recorded());
    renderForm();
    await pick('Course');
    const typed = distance();
    expect(typed).toBeInTheDocument();
    if (typed) type(typed, '5');
    await pick('Yoga');
    expect(distance()).not.toBeInTheDocument();
    typeStart('2026-11-20', '07:30');
    type(hours(), '1');
    fireEvent.click(save());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({
      sport_code: 'yoga',
      started_at: STARTED_AT,
      duration_seconds: 3600,
    });
  });

  it('asks for the label of the "other" sport, its distance optional', async () => {
    const sent = recordWith(() => recorded());
    renderForm();
    await fill({ sport: 'Autre', km: '' });
    expect(screen.getByText('facultative')).toBeInTheDocument();
    expect(screen.getByText(/compte aussi pour la distance/)).toBeInTheDocument();
    const label = screen.getByRole('textbox', { name: 'Quel sport ?' });
    type(label, 'a');
    expect(await screen.findByText('Écris entre 2 et 40 caractères.')).toBeInTheDocument();

    type(label, ' <b>Pétanque</b> ');
    fireEvent.click(save());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({
      sport_code: 'other',
      sport_label: '<b>Pétanque</b>',
      started_at: STARTED_AT,
      duration_seconds: 2700,
    });
  });

  it('always asks for the duration and refuses a start in the future', async () => {
    const sent = recordWith(() => recorded());
    renderForm();
    await pick('Yoga');
    typeStart('2026-11-20', '12:30');
    fireEvent.click(save());

    expect(
      await screen.findByText("Le début ne peut pas être dans le futur, ni avant l'an 2000."),
    ).toBeInTheDocument();
    expect(screen.getByText('Indique une durée entre 1 seconde et 24 heures.')).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it('sends once on a double click, and the button waits', async () => {
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sent = recordWith(async () => {
      await answered;
      return HttpResponse.json(
        { error: { code: 'internal_error', message: 'x' } },
        { status: 500 },
      );
    });
    renderForm();
    await fill();
    fireEvent.click(save());
    fireEvent.click(save());

    await waitFor(() => expect(save()).toBeDisabled());
    expect(save()).toHaveTextContent('Enregistrement…');
    release();
    await screen.findByRole('alert');
    expect(sent).toHaveLength(1);
  });

  it('sends the same key again when the first attempt got no clear answer', async () => {
    const sent = refuse('internal_error', 500);
    renderForm();
    await fill();
    fireEvent.click(save());
    await screen.findByText(/momentanément indisponible/);
    fireEvent.click(save());

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent.map(({ key }) => key)).toEqual([KEY, KEY]);
  });

  it('sends a corrected entry with a new key once the server refused the first', async () => {
    const sent = refuse('activity_overlap');
    renderForm();
    await fill();
    fireEvent.click(save());
    await screen.findByRole('alert');
    type(minutes(), '30');
    fireEvent.click(save());

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent.map(({ key }) => key)).toEqual([KEY, 'activity-key-2']);
    expect(sent[1]?.body.duration_seconds).toBe(1800);
  });

  it.each([
    ['week_locked', /La semaine de cette activité est terminée/],
    ['activity_overlap', /chevauche une autre de tes activités/],
    ['distance_required', /Ce sport demande une distance/],
    ['distance_not_allowed', /Ce sport ne prend pas de distance/],
    ['profile_incomplete', /Indique d'abord ton prénom et ton nom/],
  ])('says why the server refuses it (%s)', async (code, message) => {
    refuse(code);
    renderForm();
    await fill();
    fireEvent.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    // Said where the eye is, on a phone too.
    expect(screen.getByRole('alert')).toHaveFocus();
    // The form stays, with its input.
    expect(minutes()).toHaveValue('45');
  });

  it('marks the fields the server refuses', async () => {
    refuse('validation_failed', 400, { fields: 'started_at,duration_seconds' });
    renderForm();
    await fill();
    fireEvent.click(save());

    expect(await screen.findByText(/Certaines informations sont invalides/)).toBeInTheDocument();
    expect(startDate()).toHaveAttribute('aria-invalid', 'true');
    expect(startTime()).toHaveAttribute('aria-invalid', 'true');
    expect(hours()).toHaveAttribute('aria-invalid', 'true');
    // The first refused field takes the focus.
    await waitFor(() => expect(startDate()).toHaveFocus());
    expect(screen.getAllByText('Valeur refusée. Vérifie-la.')).toHaveLength(2);
  });

  it('offers a retry when the catalogue cannot load', async () => {
    let fail = true;
    server.use(
      http.get('*/api/v1/sports', () =>
        fail
          ? HttpResponse.json({ error: { code: 'internal_error', message: 'x' } }, { status: 500 })
          : HttpResponse.json({
              sports: [{ code: 'run', distance_mode: 'required', suggested_factor: 1 }],
            }),
      ),
    );
    renderForm();
    const retry = await screen.findByRole('button', { name: 'Réessayer' });
    fail = false;
    fireEvent.click(retry);

    expect(await screen.findByRole('radio', { name: 'Course' })).toBeInTheDocument();
  });
});
