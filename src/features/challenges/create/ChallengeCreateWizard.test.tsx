import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { createMemoryRouter, Link, RouterProvider, useParams } from 'react-router';
import type { ChallengeCreate } from '../../../api/hooks/useChallenges';
import { server } from '../../../mocks/server';
import { timeZoneName } from '../../../domain/format/challengeDates';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';
import { ChallengeCreateWizard } from './ChallengeCreateWizard';

// Wednesday 30 September 2026, 11:00 in Montréal.
const NOW = new Date('2026-09-30T15:00:00Z');
const ZONES = ['America/Toronto', 'Europe/Paris', 'Asia/Tokyo'];

function ChallengePage() {
  return <p>Défi {useParams().id}</p>;
}

function renderWizard({ timeZones = ZONES }: { timeZones?: readonly string[] } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/challenges/new',
        element: (
          <>
            <Link to="/">Accueil</Link>
            <ChallengeCreateWizard now={NOW} timeZones={timeZones} />
          </>
        ),
      },
      { path: '/', element: <p>Page d'accueil</p> },
      { path: '/challenges/:id', element: <ChallengePage /> },
    ],
    { initialEntries: ['/challenges/new'] },
  );
  // StrictMode, as in the app: its double mount must not count as input.
  render(
    <StrictMode>
      <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
  return router;
}

const title = () => screen.getByRole('textbox', { name: 'Titre' });
const description = () => screen.getByRole('textbox', { name: 'Description (facultative)' });
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
const weeks = () => screen.getByRole('spinbutton', { name: 'Durée' });
const startDate = () => screen.getByLabelText('Premier jour');
const timeZone = () => screen.getByRole('combobox', { name: 'Fuseau horaire' });
const preview = () => screen.getByRole('region', { name: 'Calendrier du défi' });

async function fillInfoStep() {
  type(title(), 'Défi de printemps');
  fireEvent.click(screen.getByRole('radio', { name: 'Public' }));
  next();
  await screen.findByRole('heading', { level: 2, name: 'Quand ça se passe' });
}

async function fillDurationStep() {
  type(weeks(), '6');
  type(startDate(), '2026-10-05');
  next();
  await screen.findByRole('heading', { level: 2, name: 'Comment on gagne' });
}

const stepKm = () =>
  screen.getByRole('spinbutton', { name: "Hausse minimale d'une semaine à l'autre (en km)" });
/** Opens the factors' fields if they are still pills. */
function customize() {
  const button = screen.queryByRole('button', { name: 'Personnaliser' });
  if (button) fireEvent.click(button);
}
const factor = (sport: string) => {
  customize();
  return screen.getByRole('spinbutton', { name: sport });
};
const findFactor = async (sport: string) => {
  await screen.findByRole('region', { name: 'Coefficients de distance' });
  return factor(sport);
};
const reference = () => screen.getByRole('combobox', { name: 'Sport de référence' });
const addDistance = async () =>
  fireEvent.click(await screen.findByRole('switch', { name: 'Distance cumulée' }));
const addElimination = async () =>
  fireEvent.click(await screen.findByRole('switch', { name: / avec élimination$/ }));
const addPoints = async () =>
  fireEvent.click(await screen.findByRole('switch', { name: 'Grand prix' }));
const criterion = (name: string) => screen.getByRole('checkbox', { name });
const minSession = () =>
  screen.queryByRole('spinbutton', { name: "Durée minimale d'une séance (en min)" });
const top10 = () => screen.getByRole('radio', { name: /^Top 10/ });
/** The current step, without the side column. */
const step = () => {
  const heading = screen.getByRole('heading', { level: 2 });
  if (!heading.parentElement) throw new Error('no step');
  return within(heading.parentElement);
};
/** Value and detail of a line of the recap. */
const row = (label: string) => step().getByText(label, { selector: 'dt' }).nextElementSibling;
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Créer le défi' }));

/** Up to the recap, with both optional categories unless told otherwise. */
async function reachRecap({ distance = true, elimination = true } = {}) {
  renderWizard();
  await fillInfoStep();
  await fillDurationStep();
  if (distance) await addDistance();
  if (elimination) {
    await addElimination();
    type(stepKm(), '2.5');
  }
  next();
  await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });
}

/** Answers the creation and keeps each request body. */
function answerCreation(
  response: () => Response | Promise<Response> = () =>
    HttpResponse.json({ id: 'c42' }, { status: 201 }),
) {
  const bodies: ChallengeCreate[] = [];
  server.use(
    http.post('*/api/v1/challenges', async ({ request }) => {
      bodies.push((await request.json()) as ChallengeCreate);
      return response();
    }),
  );
  return bodies;
}

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe('ChallengeCreateWizard', () => {
  it('opens on the information step', () => {
    renderWizard();

    expect(screen.getByText(/^Étape 1 sur 4/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Le défi' })).toBeInTheDocument();
    expect(title()).toHaveAccessibleDescription('Entre 3 et 80 caractères.');
    expect(screen.getByRole('radio', { name: 'Privé' })).toHaveAccessibleDescription(
      'Seules les personnes invitées le voient et peuvent le rejoindre.',
    );
    expect(screen.getByRole('radio', { name: 'Privé' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Public' })).not.toBeChecked();
    // On by default (decision of 2026-11-22).
    expect(screen.getByRole('switch', { name: 'Les participants peuvent inviter' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument();
  });

  it('counts the characters of the title', () => {
    renderWizard();
    expect(screen.getByText('0 / 80')).toBeInTheDocument();

    fireEvent.change(title(), { target: { value: "Défi d'automne" } });

    expect(screen.getByText('14 / 80')).toBeInTheDocument();
  });

  it('checks the title once left, then as it is typed', async () => {
    renderWizard();

    type(title(), 'ab');
    expect(
      await screen.findByText('Le titre doit faire entre 3 et 80 caractères.'),
    ).toBeInTheDocument();
    expect(title()).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(title(), { target: { value: 'abc' } });
    await waitFor(() => expect(title()).not.toHaveAttribute('aria-invalid'));

    type(title(), 'a'.repeat(81));
    expect(
      await screen.findByText('Le titre doit faire entre 3 et 80 caractères.'),
    ).toBeInTheDocument();

    type(title(), 'Spring​run');
    expect(
      await screen.findByText(/Le titre contient un caractère non autorisé/),
    ).toBeInTheDocument();
  });

  it('checks the description length', async () => {
    renderWizard();

    type(description(), 'a'.repeat(2001));

    expect(
      await screen.findByText('La description doit faire 2000 caractères au plus.'),
    ).toBeInTheDocument();
    expect(description()).toHaveAccessibleDescription(
      '2000 caractères au plus. La description doit faire 2000 caractères au plus.',
    );
  });

  it('shows every error of the step on Next and focuses the first field', async () => {
    renderWizard();

    next();

    expect(
      await screen.findByText('Le titre doit faire entre 3 et 80 caractères.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Choisis la visibilité du défi.')).toBeInTheDocument();
    expect(title()).toHaveFocus();
  });

  it('moves on to the duration once the step is complete, and back without loss', async () => {
    renderWizard();
    next();
    expect(await screen.findByText('Choisis la visibilité du défi.')).toBeInTheDocument();

    await fillInfoStep();
    expect(screen.getByText(/^Étape 2 sur 4/)).toBeInTheDocument();
    type(weeks(), '6');

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(await screen.findByRole('textbox', { name: 'Titre' })).toHaveValue('Défi de printemps');
    expect(screen.getByRole('radio', { name: 'Public' })).toBeChecked();
    next();
    expect(await screen.findByRole('spinbutton', { name: 'Durée' })).toHaveValue(6);
  });

  describe('duration and time zone step', () => {
    it("starts on Montréal's time zone and today as the earliest date", async () => {
      renderWizard();
      await fillInfoStep();

      expect(timeZone()).toHaveValue('America/Toronto');
      expect(screen.getByRole('option', { name: /^Toronto — / })).toHaveTextContent(
        `Toronto — ${timeZoneName('America/Toronto', 'fr')}`,
      );
      expect(startDate()).toHaveAttribute('min', '2026-09-30');
      expect(startDate()).toHaveAttribute('max', '2027-09-30');
      expect(weeks()).toHaveValue(null);
      expect(preview()).toHaveTextContent(
        "Le calendrier s'affiche une fois la durée, le premier jour et le fuseau choisis.",
      );
    });

    it.each(['1', '53', '2.5'])('refuses %s weeks', async (value) => {
      renderWizard();
      await fillInfoStep();

      type(weeks(), value);

      expect(
        await screen.findByText('La durée doit être un nombre entier de semaines, de 2 à 52.'),
      ).toBeInTheDocument();
      expect(weeks()).toHaveAttribute('aria-invalid', 'true');
    });

    it('asks for every field on Enter', async () => {
      renderWizard();
      await fillInfoStep();
      fireEvent.change(timeZone(), { target: { value: '' } });

      fireEvent.submit(weeks());

      expect(
        await screen.findByText('La durée doit être un nombre entier de semaines, de 2 à 52.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Choisis la date de début.')).toBeInTheDocument();
      expect(screen.getByText('Choisis un fuseau horaire dans la liste.')).toBeInTheDocument();
      expect(weeks()).toHaveFocus();
    });

    it('refuses a start date before today in the chosen time zone', async () => {
      renderWizard();
      await fillInfoStep();

      type(startDate(), '2026-09-29');

      expect(
        await screen.findByText(
          "La date de début doit être entre aujourd'hui et la même date l'an prochain.",
        ),
      ).toBeInTheDocument();
    });

    it('checks the start date again when the time zone changes', async () => {
      renderWizard();
      await fillInfoStep();
      // Today in Montréal, already yesterday in Tokyo.
      type(startDate(), '2026-09-30');
      await waitFor(() => expect(startDate()).not.toHaveAttribute('aria-invalid'));

      fireEvent.change(timeZone(), { target: { value: 'Asia/Tokyo' } });

      expect(
        await screen.findByText(
          "La date de début doit être entre aujourd'hui et la même date l'an prochain.",
        ),
      ).toBeInTheDocument();

      fireEvent.change(timeZone(), { target: { value: 'America/Toronto' } });
      await waitFor(() => expect(startDate()).not.toHaveAttribute('aria-invalid'));
    });

    it('shows the calendar in the chosen time zone, across the change to winter time', async () => {
      renderWizard();
      await fillInfoStep();

      type(weeks(), '6');
      type(startDate(), '2026-10-05');

      await waitFor(() =>
        expect(preview()).toHaveTextContent(
          'Du lundi 5 octobre 2026 au dimanche 15 novembre 2026 inclus.',
        ),
      );
      expect(preview()).toHaveTextContent(
        `Chaque semaine commence le lundi à minuit, ${timeZoneName('America/Toronto', 'fr')}.`,
      );
      const tiles = () =>
        within(screen.getByRole('list', { name: 'Semaines du défi' }))
          .getAllByRole('listitem')
          .map((tile) => tile.textContent);
      expect(tiles()).toEqual([
        'Semaine 15 oct. – 11 oct.',
        'Semaine 212 oct. – 18 oct.',
        'Semaine 319 oct. – 25 oct.',
        'Semaine 426 oct. – 1 nov.',
        'Semaine 52 nov. – 8 nov.',
        'Semaine 69 nov. – 15 nov.',
      ]);

      fireEvent.change(timeZone(), { target: { value: 'Asia/Tokyo' } });
      await waitFor(() =>
        expect(preview()).toHaveTextContent(
          `Chaque semaine commence le lundi à minuit, ${timeZoneName('Asia/Tokyo', 'fr')}.`,
        ),
      );
      expect(tiles()).toHaveLength(6);
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });

    it('sets the duration with the buttons, within 2 to 52 weeks', async () => {
      renderWizard();
      await fillInfoStep();
      const less = () => screen.getByRole('button', { name: 'Une semaine de moins' });
      const more = () => screen.getByRole('button', { name: 'Une semaine de plus' });

      fireEvent.click(more());
      expect(weeks()).toHaveValue(2);
      // Still focusable at the bound, but does nothing.
      expect(less()).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(less());
      expect(weeks()).toHaveValue(2);
      fireEvent.click(more());
      expect(weeks()).toHaveValue(3);
      expect(screen.getByText('semaines')).toBeInTheDocument();
      fireEvent.click(less());
      expect(weeks()).toHaveValue(2);

      type(weeks(), '52');
      await waitFor(() => expect(more()).toHaveAttribute('aria-disabled', 'true'));
      fireEvent.click(less());
      expect(weeks()).toHaveValue(51);
    });

    it('empties the preview once a field no longer fits', async () => {
      renderWizard();
      await fillInfoStep();
      type(weeks(), '6');
      type(startDate(), '2026-10-05');
      await waitFor(() => expect(preview()).toHaveTextContent('Semaine 6'));

      type(weeks(), '');
      await waitFor(() =>
        expect(preview()).toHaveTextContent(
          "Le calendrier s'affiche une fois la durée, le premier jour et le fuseau choisis.",
        ),
      );

      type(weeks(), '6');
      type(startDate(), '2026-09-29');
      expect(
        await screen.findByText(
          "La date de début doit être entre aujourd'hui et la même date l'an prochain.",
        ),
      ).toBeInTheDocument();
      expect(preview()).not.toHaveTextContent('Semaine 6');
    });

    it('names every region of the picker in French', async () => {
      renderWizard({
        timeZones: [
          'Africa/Cairo',
          'America/Toronto',
          'Antarctica/Troll',
          'Arctic/Longyearbyen',
          'Asia/Tokyo',
          'Atlantic/Azores',
          'Australia/Sydney',
          'Europe/Paris',
          'Indian/Maldives',
          'Pacific/Auckland',
          'Etc/GMT+5',
          'UTC',
        ],
      });
      await fillInfoStep();

      expect([...timeZone().querySelectorAll('optgroup')].map((group) => group.label)).toEqual([
        'Afrique',
        'Amérique',
        'Antarctique',
        'Arctique',
        'Asie',
        'Atlantique',
        'Australie',
        'Europe',
        'Océan Indien',
        'Pacifique',
        'Autres',
      ]);
    });
  });

  it('leaves at once when nothing was entered', async () => {
    const router = renderWizard();

    fireEvent.click(screen.getByRole('link', { name: 'Accueil' }));

    expect(await screen.findByText("Page d'accueil")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('asks before leaving with unsent input, and keeps it when the user stays', async () => {
    const router = renderWizard();
    type(title(), 'Défi de printemps');

    fireEvent.click(screen.getByRole('link', { name: 'Accueil' }));
    const dialog = await screen.findByRole('dialog', { name: 'Quitter la création ?' });
    expect(dialog).toHaveAccessibleDescription(
      "Ta saisie n'est pas enregistrée : elle sera perdue.",
    );
    expect(screen.getByRole('button', { name: 'Continuer la saisie' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer la saisie' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/challenges/new');
    expect(title()).toHaveValue('Défi de printemps');

    fireEvent.click(screen.getByRole('link', { name: 'Accueil' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitter' }));
    expect(await screen.findByText("Page d'accueil")).toBeInTheDocument();
  });

  it('warns before the tab is closed with unsent input', async () => {
    renderWizard();
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);
    type(title(), 'Défi de printemps');
    await waitFor(() => expect(unload()).toBe(true));
  });

  describe('categories step', () => {
    it('starts on the run as reference, with the total time alone', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();

      expect(screen.getByText(/^Étape 3 sur 4/)).toBeInTheDocument();
      expect(await screen.findByRole('combobox', { name: 'Sport de référence' })).toHaveValue(
        'run',
      );
      // The sports whose distance is required, by name.
      expect([...reference().querySelectorAll('option')].map(({ value }) => value)).toEqual([
        'rowing',
        'run',
        'walk',
        'swim',
        'hike',
        'roller',
        'xc_ski',
        'ride',
      ]);
      for (const name of [
        'Temps cumulé',
        'Distance cumulée',
        'Course avec élimination',
        'Grand prix',
      ]) {
        expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
      }
      expect(screen.getByText('Toujours inclus')).toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Temps cumulé' })).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Distance cumulée' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Distance cumulée' })).toHaveAccessibleDescription(
        'Les km de toutes les activités à distance, ramenés au sport de référence avec les coefficients plus bas.',
      );
      expect(screen.getByRole('switch', { name: 'Course avec élimination' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Grand prix' })).not.toBeChecked();
      expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    });

    it('shows the suggested factors once the total distance is added', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();

      await addDistance();

      // Pills first, the reference in front.
      const pills = within(
        await screen.findByRole('region', { name: 'Coefficients de distance' }),
      ).getAllByRole('listitem');
      expect(pills.map((pill) => pill.textContent)).toEqual([
        'Course ×1 (référence)',
        'Aviron ×0,5',
        'Marche ×1',
        'Natation ×1',
        'Randonnée ×1',
        'Roller ×0,5',
        'Ski de fond ×0,5',
        'Vélo ×0,3',
        'Autre ×1',
      ]);
      expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);

      expect(await findFactor('Vélo')).toHaveValue(0.3);
      expect(screen.queryByRole('button', { name: 'Personnaliser' })).not.toBeInTheDocument();
      expect(factor('Aviron')).toHaveValue(0.5);
      expect(factor('Vélo')).toHaveAccessibleDescription('Proposé : ×0,3');
      // The reference counts ×1, without a field.
      expect(screen.getByText('Course ×1 (référence)')).toBeInTheDocument();
      expect(screen.queryByRole('spinbutton', { name: 'Course' })).not.toBeInTheDocument();
      expect(screen.queryByRole('spinbutton', { name: 'Yoga' })).not.toBeInTheDocument();
      // By name, the free sport last.
      expect(screen.getAllByRole('spinbutton').map((field) => field.getAttribute('id'))).toEqual([
        'factor-rowing',
        'factor-walk',
        'factor-swim',
        'factor-hike',
        'factor-roller',
        'factor-xc_ski',
        'factor-ride',
        'factor-other',
      ]);

      await addDistance();
      expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    });

    it('sets the points: criteria, scale, and the minimum session with the number of sessions', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();

      expect(screen.getByRole('heading', { level: 3, name: 'Grand prix' })).toBeInTheDocument();
      expect(
        screen.queryByRole('group', { name: 'Critères de la semaine' }),
      ).not.toBeInTheDocument();
      await addPoints();

      for (const name of [
        'Séance la plus longue en temps',
        'Séance la plus longue en distance équivalente',
        'Nombre de séances',
      ]) {
        expect(criterion(name)).not.toBeChecked();
      }
      // The scale shows its points; the creator chooses it.
      expect(screen.getByRole('radio', { name: 'Top 5' })).toHaveAccessibleDescription(
        '10 · 8 · 6 · 4 · 2 points',
      );
      expect(screen.getByRole('radio', { name: 'Top 5' })).not.toBeChecked();
      expect(top10()).toHaveAccessibleName('Top 10');
      expect(top10()).toHaveAccessibleDescription(
        '25 · 18 · 15 · 12 · 10 · 8 · 6 · 4 · 2 · 1 point',
      );
      expect(top10()).not.toBeChecked();
      expect(minSession()).not.toBeInTheDocument();

      fireEvent.click(criterion('Nombre de séances'));
      expect(minSession()).toHaveValue(20);
      expect(minSession()).toHaveAccessibleDescription(
        'De 1 à 180 min : une séance plus courte ne compte pas.',
      );
      fireEvent.click(criterion('Nombre de séances'));
      expect(minSession()).not.toBeInTheDocument();
    });

    it('asks for a criterion, a scale and a valid minimum session', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addPoints();

      next();
      expect(await screen.findByText('Coche au moins un critère.')).toBeInTheDocument();
      expect(screen.getByText('Choisis un barème.')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: 'Comment on gagne' }),
      ).toBeInTheDocument();

      // Checked once left, as every field.
      for (const choice of [criterion('Nombre de séances'), top10()]) {
        fireEvent.click(choice);
        fireEvent.blur(choice);
      }
      const field = minSession();
      if (!field) throw new Error('no minimum session');
      type(field, '181');
      expect(
        await screen.findByText(
          'La durée minimale doit être un nombre entier de minutes, de 1 à 180.',
        ),
      ).toBeInTheDocument();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('Coche au moins un critère.')).not.toBeInTheDocument();
      expect(screen.queryByText('Choisis un barème.')).not.toBeInTheDocument();
    });

    it('shows the factors for the total distance or the longest session by distance', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addPoints();
      const factors = () => screen.queryByRole('region', { name: 'Coefficients de distance' });

      expect(factors()).not.toBeInTheDocument();
      fireEvent.click(criterion('Séance la plus longue en temps'));
      expect(factors()).not.toBeInTheDocument();

      fireEvent.click(criterion('Séance la plus longue en distance équivalente'));
      expect(factors()).toBeInTheDocument();
      expect(factor('Vélo')).toHaveValue(0.3);

      await addDistance();
      fireEvent.click(criterion('Séance la plus longue en distance équivalente'));
      expect(factors()).toBeInTheDocument();
      await addDistance();
      expect(factors()).not.toBeInTheDocument();

      // The criterion counts with the points only.
      fireEvent.click(criterion('Séance la plus longue en distance équivalente'));
      await addPoints();
      expect(factors()).not.toBeInTheDocument();
    });

    it('brings the suggestions back to a new reference, the changed factors staying', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addDistance();
      type(await findFactor('Natation'), '0.8');

      fireEvent.change(reference(), { target: { value: 'rowing' } });

      expect(
        await screen.findByRole('heading', { level: 3, name: 'Aviron avec élimination' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Aviron ×1 (référence)')).toBeInTheDocument();
      expect(screen.queryByRole('spinbutton', { name: 'Aviron' })).not.toBeInTheDocument();
      expect(factor('Vélo')).toHaveValue(0.6);
      expect(factor('Vélo')).toHaveAccessibleDescription('Proposé : ×0,6');
      expect(factor('Course')).toHaveValue(1);
      expect(factor('Natation')).toHaveValue(0.8);

      fireEvent.change(reference(), { target: { value: 'run' } });
      await waitFor(() => expect(factor('Vélo')).toHaveValue(0.3));
      expect(factor('Aviron')).toHaveValue(0.5);
    });

    it('shows the new suggestions when the total distance is added after a change of reference', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addDistance();
      await findFactor('Vélo');
      await addDistance();

      fireEvent.change(reference(), { target: { value: 'rowing' } });
      await addDistance();

      expect(await findFactor('Vélo')).toHaveValue(0.6);
      expect(factor('Vélo')).toHaveAccessibleDescription('Proposé : ×0,6');
      expect(factor('Course')).toHaveValue(1);
    });

    it('gives a worked example of X, in the reference sport', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addElimination();

      type(stepKm(), '2');

      const example = () => document.getElementById('elimination-example');
      // Testing Library reads the narrow no-break spaces as spaces.
      expect(example()).toHaveTextContent(
        'Exemple5 km en semaine 1 → au moins 7 km en semaine 210 km en semaine 2 → au moins 12 km en semaine 3',
      );
      expect(stepKm()).toHaveAccessibleDescription(
        expect.stringMatching(/5\skm en semaine 1 → au moins 7\skm en semaine 2/),
      );
      expect(screen.getByText(/^Course seulement, en distance réelle/)).toBeInTheDocument();

      // Above the minimum, whatever X.
      type(stepKm(), '8');
      expect(example()).toHaveTextContent(
        'Exemple5 km en semaine 1 → au moins 13 km en semaine 216 km en semaine 2 → au moins 24 km en semaine 3',
      );
    });

    it.each(['0', '100.5', '2.25', ''])('refuses X = %j', async (value) => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addElimination();

      type(stepKm(), value);
      next();

      expect(
        await screen.findByText(
          'La hausse doit être entre 0,1 et 100 km, avec une décimale au plus.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(/^Étape 3 sur 4/)).toBeInTheDocument();
    });

    it('keeps a changed factor across the steps, shown in the pills', async () => {
      const bodies = answerCreation();
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addDistance();
      type(await findFactor('Vélo'), '0.4');
      next();
      await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }));

      // Pills again, with the factor entered.
      const factors = await screen.findByRole('region', { name: 'Coefficients de distance' });
      expect(within(factors).getByText('Vélo ×0,4')).toBeInTheDocument();
      next();
      await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });
      send();

      await screen.findByText('Défi c42');
      expect(bodies[0]?.distance_factors).toEqual({ ride: 0.4 });
    });

    it('refuses a factor out of range', async () => {
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addDistance();

      type(await findFactor('Vélo'), '3');
      next();

      expect(
        await screen.findByText(
          'Le coefficient doit être entre 0,1 et 2, avec deux décimales au plus.',
        ),
      ).toBeInTheDocument();
      expect(factor('Vélo')).toHaveAttribute('aria-invalid', 'true');
    });

    it('offers a retry when the sports do not load', async () => {
      let fail = true;
      server.use(
        http.get('*/api/v1/sports', () =>
          fail
            ? HttpResponse.json({ error: { code: 'internal_error' } }, { status: 500 })
            : HttpResponse.json({
                sports: [
                  { code: 'ride', distance_mode: 'required', suggested_factor: 0.3 },
                  { code: 'run', distance_mode: 'required', suggested_factor: 1 },
                ],
              }),
        ),
      );
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();

      await screen.findByRole('button', { name: 'Réessayer' });
      next();
      // The sports must be seen first: the step stays, and says why.
      expect(
        await screen.findByText(
          "Les sports doivent s'afficher avant de continuer : patiente ou réessaie.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(/^Étape 3 sur 4/)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tout vérifier' })).not.toBeInTheDocument();

      fail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

      expect(await screen.findByRole('combobox', { name: 'Sport de référence' })).toHaveValue(
        'run',
      );
      expect(
        screen.queryByText(
          "Les sports doivent s'afficher avant de continuer : patiente ou réessaie.",
        ),
      ).not.toBeInTheDocument();
    });
  });

  describe('preview in the list, beside the steps', () => {
    // The device's time zone is mocked by one test: never left to the next.
    afterEach(() => {
      vi.restoreAllMocks();
    });
    const aside = () => within(screen.getByRole('complementary'));
    const card = () =>
      within(aside().getByRole('region', { name: 'Aperçu dans la liste des défis' }));

    it('fills in as the challenge is entered, with a tip for each step', async () => {
      renderWizard();

      expect(card().getByText('Temps cumulé')).toBeInTheDocument();
      expect(card().getByText('Sport de référence : Course')).toBeInTheDocument();
      expect(card().queryByText('À venir')).not.toBeInTheDocument();
      expect(aside().getByRole('region', { name: 'Bon à savoir' })).toHaveTextContent(
        /^Bon à savoirUn défi privé n'apparaît que pour les personnes invitées/,
      );

      await fillInfoStep();
      expect(card().getByText('Défi de printemps')).toBeInTheDocument();
      expect(card().getByText('Public')).toBeInTheDocument();
      expect(aside().getByRole('region', { name: 'Bon à savoir' })).toHaveTextContent(
        /Chaque semaine est jugée le lendemain de sa fin, à 7 h/,
      );

      type(weeks(), '6');
      type(startDate(), '2026-10-05');
      expect(await card().findByText('5 oct. → 15 nov. · 6 semaines')).toBeInTheDocument();
      expect(card().getByText('À venir')).toBeInTheDocument();
      next();
      await screen.findByRole('heading', { level: 2, name: 'Comment on gagne' });
      await addElimination();
      expect(card().getByText('Course avec élimination')).toBeInTheDocument();
      expect(card().queryByText('Distance cumulée')).not.toBeInTheDocument();
    });

    it("names the challenge's time zone when it is not the device's", async () => {
      const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
        this: Intl.DateTimeFormat,
      ) {
        return { ...resolved.call(this), timeZone: 'Europe/Paris' };
      });
      renderWizard();
      await fillInfoStep();
      type(weeks(), '6');
      type(startDate(), '2026-10-05');

      expect(await card().findByText(timeZoneName('America/Toronto', 'fr'))).toBeInTheDocument();
    });

    it('is ongoing when it starts today', async () => {
      renderWizard();
      await fillInfoStep();

      type(weeks(), '2');
      type(startDate(), '2026-09-30');

      expect(await card().findByText('En cours')).toBeInTheDocument();
      expect(card().queryByText('À venir')).not.toBeInTheDocument();
    });
  });

  describe('summary and sending', () => {
    it('sums everything up with the warning, then creates and opens the challenge', async () => {
      const bodies = answerCreation();
      await reachRecap();

      expect(screen.getByText(/^Étape 4 sur 4/)).toBeInTheDocument();
      expect(row('Titre')).toHaveTextContent('Défi de printemps');
      expect(row('Visibilité')).toHaveTextContent("PublicListé dans l'onglet Publics");
      expect(row('Invitations')).toHaveTextContent('Tous les participants');
      expect(row('Période')).toHaveTextContent(
        '5 oct. → 15 nov. · 6 semainesDu lundi 5 octobre 2026 au dimanche 15 novembre 2026',
      );
      const zone = timeZoneName('America/Toronto', 'fr');
      expect(row('Fuseau')).toHaveTextContent(
        `${zone.charAt(0).toUpperCase()}${zone.slice(1)}Toronto`,
      );
      expect(row('Sport de référence')).toHaveTextContent('Course');
      expect(row('Temps cumulé')).toHaveTextContent('InclusTous sports confondus');
      expect(row('Distance cumulée')).toHaveTextContent('IncluseRamenée au sport de référence');
      expect(row('Élimination')).toHaveTextContent(
        "+2,5 km par semaineCourse seulement, pas d'élimination en semaine 1",
      );
      expect(row('Grand prix')).toHaveTextContent('Non inclus');
      expect(row('Coefficients')).toHaveTextContent(
        'Valeurs proposéesAviron ×0,5 · Marche ×1 · Natation ×1 · Randonnée ×1 · Roller ×0,5 · Ski de fond ×0,5 · Vélo ×0,3 · Autre ×1',
      );
      expect(
        screen.getByText(
          'Après la création, seuls le titre et la description pourront être modifiés : catégories, sport de référence, réglages, dates et visibilité seront figés.',
        ),
      ).toBeInTheDocument();

      send();

      expect(await screen.findByText('Défi c42')).toBeInTheDocument();
      expect(bodies).toEqual([
        {
          title: 'Défi de printemps',
          description: '',
          visibility: 'public',
          members_can_invite: true,
          timezone: 'America/Toronto',
          start_date: '2026-10-05',
          weeks: 6,
          reference_sport: 'run',
          categories: { cumulative_distance: {}, elimination: { step_meters: 2500 } },
        },
      ]);
    });

    it('goes back to a part of the recap, then on to the recap again without loss', async () => {
      await reachRecap();

      fireEvent.click(screen.getByRole('button', { name: 'Modifier : Dates' }));

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Quand ça se passe' }),
      ).toHaveFocus();
      expect(weeks()).toHaveValue(6);
      next();
      await screen.findByRole('heading', { level: 2, name: 'Comment on gagne' });
      next();
      await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });
      expect(row('Élimination')).toHaveTextContent('+2,5 km par semaine');

      fireEvent.click(screen.getByRole('button', { name: 'Modifier : Infos' }));
      expect(await screen.findByRole('heading', { level: 2, name: 'Le défi' })).toBeInTheDocument();
      expect(title()).toHaveValue('Défi de printemps');
    });

    it('creates a challenge with the total time alone', async () => {
      const bodies = answerCreation();
      await reachRecap({ distance: false, elimination: false });

      expect(row('Temps cumulé')).toHaveTextContent('Inclus');
      expect(row('Distance cumulée')).toHaveTextContent('Non incluse');
      expect(row('Élimination')).toHaveTextContent('Non incluse');
      expect(step().queryByText('Coefficients')).not.toBeInTheDocument();

      send();

      await screen.findByText('Défi c42');
      expect(bodies[0]).not.toHaveProperty('categories');
      expect(bodies[0]).not.toHaveProperty('distance_factors');
      expect(bodies[0]?.reference_sport).toBe('run');
    });

    it('sums up and sends the points, with the factors of the longest session by distance', async () => {
      const bodies = answerCreation();
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addPoints();
      fireEvent.click(criterion('Séance la plus longue en distance équivalente'));
      fireEvent.click(criterion('Nombre de séances'));
      const field = minSession();
      if (!field) throw new Error('no minimum session');
      type(field, '30');
      fireEvent.click(top10());
      type(factor('Vélo'), '0.25');
      next();
      await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });

      expect(row('Grand prix')).toHaveTextContent(
        'Top 10 · 25 à 1 pointCritères : séance la plus longue en distance équivalente, nombre de séancesUne séance compte à partir de 30 min',
      );
      expect(row('Distance cumulée')).toHaveTextContent('Non incluse');
      expect(row('Coefficients')).toHaveTextContent('Valeurs personnalisées');
      expect(row('Coefficients')).toHaveTextContent('Vélo ×0,25');

      send();

      await screen.findByText('Défi c42');
      expect(bodies[0]?.categories).toEqual({
        points: {
          criteria: ['longest_distance', 'session_count'],
          podium: 10,
          min_session_minutes: 30,
        },
      });
      expect(bodies[0]?.distance_factors).toEqual({ ride: 0.25 });
    });

    it('sums up the points without a minimum session when the sessions are not counted', async () => {
      const bodies = answerCreation();
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addPoints();
      fireEvent.click(criterion('Séance la plus longue en temps'));
      fireEvent.click(screen.getByRole('radio', { name: /^Top 5/ }));
      next();
      await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });

      expect(row('Grand prix')).toHaveTextContent(
        'Top 5 · 10 à 2 pointsCritères : séance la plus longue en temps',
      );
      expect(step().queryByText(/Une séance compte à partir de/)).not.toBeInTheDocument();
      expect(step().queryByText('Coefficients')).not.toBeInTheDocument();

      send();

      await screen.findByText('Défi c42');
      expect(bodies[0]?.categories).toEqual({
        points: { criteria: ['longest_duration'], podium: 5, min_session_minutes: 20 },
      });
      expect(bodies[0]).not.toHaveProperty('distance_factors');
    });

    it('shows the refused points settings on their fields', async () => {
      answerCreation(() =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_failed',
              params: {
                fields:
                  'categories.points.criteria,categories.points.podium,categories.points.min_session_minutes',
              },
            },
          },
          { status: 400 },
        ),
      );
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addPoints();
      fireEvent.click(criterion('Nombre de séances'));
      fireEvent.click(top10());
      next();
      await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });

      send();

      expect(
        await screen.findByText(
          "Certaines informations ont été refusées : Critères de la semaine, Barème, par semaine et par critère, Durée minimale d'une séance (en min). Corrige-les, puis réessaie.",
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
      const refused = expect.stringContaining('Valeur refusée. Vérifie-la, puis renvoie le défi.');
      expect(
        await screen.findByRole('group', { name: 'Critères de la semaine' }),
      ).toHaveAccessibleDescription(refused);
      expect(
        screen.getByRole('group', { name: 'Barème, par semaine et par critère' }),
      ).toHaveAccessibleDescription(refused);
      expect(minSession()).toHaveAttribute('aria-invalid', 'true');
    });

    it('sends the factors changed from the suggestions of the reference chosen', async () => {
      const bodies = answerCreation();
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addDistance();
      type(await findFactor('Natation'), '0.8');
      fireEvent.change(reference(), { target: { value: 'ride' } });
      await findFactor('Course');
      next();
      await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });
      expect(row('Sport de référence')).toHaveTextContent('Vélo');
      expect(row('Coefficients')).toHaveTextContent('Valeurs personnalisées');
      expect(row('Coefficients')).toHaveTextContent('Natation ×0,8');

      send();

      await screen.findByText('Défi c42');
      expect(bodies[0]?.reference_sport).toBe('ride');
      expect(bodies[0]?.categories).toEqual({ cumulative_distance: {} });
      expect(bodies[0]?.distance_factors).toEqual({ swim: 0.8 });
    });

    it('sends only the factors the creator changed', async () => {
      const bodies = answerCreation();
      renderWizard();
      await fillInfoStep();
      await fillDurationStep();
      await addDistance();
      type(await findFactor('Vélo'), '0.25');
      next();
      await screen.findByRole('heading', { level: 2, name: 'Tout vérifier' });

      send();

      await screen.findByText('Défi c42');
      expect(bodies[0]?.distance_factors).toEqual({ ride: 0.25 });
    });

    it('sends once on a double click, the button showing it is busy', async () => {
      let answer: () => void = () => undefined;
      const bodies = answerCreation(async () => {
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        return HttpResponse.json({ id: 'c42' }, { status: 201 });
      });
      await reachRecap();

      send();
      send();
      const busy = await screen.findByRole('button', { name: 'Création…' });
      expect(busy).toBeDisabled();
      fireEvent.click(busy);
      answer();

      expect(await screen.findByText('Défi c42')).toBeInTheDocument();
      expect(bodies).toHaveLength(1);
    });

    it('shows the refused fields where they are entered', async () => {
      answerCreation(() =>
        HttpResponse.json(
          {
            error: { code: 'validation_failed', params: { fields: 'title,distance_factors.ride' } },
          },
          { status: 400 },
        ),
      );
      await reachRecap();

      send();

      expect(
        await screen.findByText(
          'Certaines informations ont été refusées : Titre, Vélo. Corrige-les, puis réessaie.',
        ),
      ).toBeInTheDocument();
      for (let step = 0; step < 3; step += 1) {
        fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
      }
      expect(await screen.findByRole('textbox', { name: 'Titre' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(
        screen.getByText('Valeur refusée. Vérifie-la, puis renvoie le défi.'),
      ).toBeInTheDocument();
    });

    it('shows a refused X on its field', async () => {
      answerCreation(() =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_failed',
              params: { fields: 'categories.elimination.step_meters' },
            },
          },
          { status: 400 },
        ),
      );
      await reachRecap();

      send();

      expect(
        await screen.findByText(
          "Certaines informations ont été refusées : Hausse minimale d'une semaine à l'autre. Corrige-les, puis réessaie.",
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
      expect(
        await screen.findByRole('spinbutton', {
          name: "Hausse minimale d'une semaine à l'autre (en km)",
        }),
      ).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows a refused reference and refused factors on their fields', async () => {
      answerCreation(() =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_failed',
              params: { fields: 'reference_sport,distance_factors' },
            },
          },
          { status: 400 },
        ),
      );
      await reachRecap();

      send();

      expect(
        await screen.findByText(
          'Certaines informations ont été refusées : Sport de référence, Coefficients de distance. Corrige-les, puis réessaie.',
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
      expect(await screen.findByRole('combobox', { name: 'Sport de référence' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(
        screen.getByRole('group', { name: 'Coefficients de distance' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining('Valeur refusée. Vérifie-la, puis renvoie le défi.'),
      );
    });

    it.each([
      [422, 'profile_incomplete', "Indique d'abord ton prénom et ton nom dans ton profil."],
      [
        500,
        'internal_error',
        'Le service est momentanément indisponible. Réessaie dans un instant.',
      ],
    ])('translates a %d %s', async (status, code, message) => {
      answerCreation(() => HttpResponse.json({ error: { code } }, { status }));
      await reachRecap();

      send();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      await waitFor(() => expect(alert).toHaveFocus());
      expect(screen.getByRole('button', { name: 'Créer le défi' })).toBeEnabled();
    });

    it('leaves without asking once created', async () => {
      answerCreation();
      await reachRecap();

      send();

      expect(await screen.findByText('Défi c42')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
