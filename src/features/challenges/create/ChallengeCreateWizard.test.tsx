import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { timeZoneName } from '../../../domain/format/challengeDates';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';
import { ChallengeCreateWizard } from './ChallengeCreateWizard';

// Wednesday 30 September 2026, 11:00 in Montréal.
const NOW = new Date('2026-09-30T15:00:00Z');
const ZONES = ['America/Toronto', 'Europe/Paris', 'Asia/Tokyo'];

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
const weeks = () => screen.getByRole('spinbutton', { name: 'Durée (en semaines)' });
const startDate = () => screen.getByLabelText('Date de début');
const timeZone = () => screen.getByRole('combobox', { name: 'Fuseau horaire' });
const preview = () => screen.getByRole('region', { name: 'Aperçu' });

async function fillInfoStep() {
  type(title(), 'Défi de printemps');
  fireEvent.click(screen.getByRole('radio', { name: 'Public' }));
  next();
  await screen.findByRole('heading', { level: 2, name: 'Durée et fuseau' });
}

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe('ChallengeCreateWizard', () => {
  it('opens on the information step', () => {
    renderWizard();

    expect(screen.getByText('Étape 1 sur 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Informations' })).toBeInTheDocument();
    expect(title()).toHaveAccessibleDescription('Entre 3 et 80 caractères.');
    expect(screen.getByRole('radio', { name: 'Privé' })).toHaveAccessibleDescription(
      'Sur invitation seulement.',
    );
    expect(screen.getByRole('radio', { name: 'Privé' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Public' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Les participants peuvent inviter' }),
    ).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument();
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
    expect(screen.getByText('Étape 2 sur 2')).toBeInTheDocument();
    type(weeks(), '6');

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(await screen.findByRole('textbox', { name: 'Titre' })).toHaveValue('Défi de printemps');
    expect(screen.getByRole('radio', { name: 'Public' })).toBeChecked();
    next();
    expect(await screen.findByRole('spinbutton', { name: 'Durée (en semaines)' })).toHaveValue(6);
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
        "L'aperçu s'affiche une fois la durée, la date et le fuseau choisis.",
      );
      // The last step: nothing comes after it yet.
      expect(screen.queryByRole('button', { name: 'Suivant' })).not.toBeInTheDocument();
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

    it('previews the window in the chosen time zone, across the change to winter time', async () => {
      renderWizard();
      await fillInfoStep();

      type(weeks(), '6');
      type(startDate(), '2026-10-05');

      await waitFor(() =>
        expect(preview()).toHaveTextContent(
          `Du lundi 5 octobre à 00 h au lundi 16 novembre à 00 h, ${timeZoneName('America/Toronto', 'fr')}.`,
        ),
      );
      expect(preview()).toHaveTextContent('6 semaines');

      fireEvent.change(timeZone(), { target: { value: 'Asia/Tokyo' } });
      await waitFor(() =>
        expect(preview()).toHaveTextContent(
          `Du lundi 5 octobre à 00 h au lundi 16 novembre à 00 h, ${timeZoneName('Asia/Tokyo', 'fr')}.`,
        ),
      );
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });

    it('empties the preview once a field no longer fits', async () => {
      renderWizard();
      await fillInfoStep();
      type(weeks(), '6');
      type(startDate(), '2026-10-05');
      await waitFor(() => expect(preview()).toHaveTextContent('6 semaines'));

      type(weeks(), '');
      await waitFor(() =>
        expect(preview()).toHaveTextContent(
          "L'aperçu s'affiche une fois la durée, la date et le fuseau choisis.",
        ),
      );

      type(weeks(), '6');
      type(startDate(), '2026-09-29');
      expect(
        await screen.findByText(
          "La date de début doit être entre aujourd'hui et la même date l'an prochain.",
        ),
      ).toBeInTheDocument();
      expect(preview()).not.toHaveTextContent('6 semaines');
    });

    it('names every region of the time zones the browser knows', async () => {
      renderWizard({ timeZones: Intl.supportedValuesOf('timeZone') });
      await fillInfoStep();

      const regions = [...timeZone().querySelectorAll('optgroup')].map((group) => group.label);
      expect(regions).toContain('Amérique');
      expect(regions.filter((label) => label.startsWith('challengeCreate.'))).toEqual([]);
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
});
