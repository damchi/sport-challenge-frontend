import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';
import { ChallengeCreateWizard } from './ChallengeCreateWizard';

function renderWizard() {
  const router = createMemoryRouter(
    [
      {
        path: '/challenges/new',
        element: (
          <>
            <Link to="/">Accueil</Link>
            <ChallengeCreateWizard />
          </>
        ),
      },
      { path: '/', element: <p>Page d'accueil</p> },
    ],
    { initialEntries: ['/challenges/new'] },
  );
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const title = () => screen.getByRole('textbox', { name: 'Titre' });
const description = () => screen.getByRole('textbox', { name: 'Description (facultative)' });
// The only step is the last: no Next button, Enter in a field checks the step.
const submit = () => fireEvent.submit(title());

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe('ChallengeCreateWizard', () => {
  it('opens on the information step', () => {
    renderWizard();

    expect(screen.getByText('Étape 1 sur 1')).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Suivant' })).not.toBeInTheDocument();
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

  it('shows every error of the step on Enter and focuses the first field', async () => {
    renderWizard();

    submit();

    expect(
      await screen.findByText('Le titre doit faire entre 3 et 80 caractères.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Choisis la visibilité du défi.')).toBeInTheDocument();
    expect(title()).toHaveFocus();
  });

  it('clears the step errors once it is complete', async () => {
    renderWizard();
    submit();
    expect(await screen.findByText('Choisis la visibilité du défi.')).toBeInTheDocument();

    type(title(), 'Défi de printemps');
    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Les participants peuvent inviter' }));
    submit();

    await waitFor(() => expect(screen.queryAllByRole('alert')).toHaveLength(0));
    expect(title()).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('radio', { name: 'Public' })).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('radio', { name: 'Public' })).toBeChecked();
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
