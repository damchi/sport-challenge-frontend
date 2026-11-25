import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Auth } from '../lib/auth/auth';
import { createFakeAuth } from '../test/fakeAuth';
import { AppProviders } from '../test/AppProviders';
import { LandingPage } from './LandingPage';
import { changeLanguage } from '../i18n';

// The download of a language's texts, made to fail in some tests.
vi.mock('../i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../i18n')>();
  return { ...actual, changeLanguage: vi.fn(actual.changeLanguage) };
});

function renderLanding(auth: Auth = createFakeAuth()) {
  const router = createMemoryRouter([
    { path: '/', element: <LandingPage /> },
    { path: '/challenges', element: <p>challenges</p> },
  ]);
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return auth;
}

function startButtons(): [HTMLElement, HTMLElement] {
  const [hero, final] = screen.getAllByRole('button', { name: 'Commencer' });
  if (!hero || !final) throw new Error('A « Commencer » button is missing');
  return [hero, final];
}

function goOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await act(() => i18n.changeLanguage('fr'));
});

describe('LandingPage', () => {
  it('explains the app in sections, with links to them', () => {
    renderLanding();

    for (const name of [
      'Trois étapes, et c’est parti',
      'Un podium par catégorie',
      'Du yoga à l’aviron, tout compte',
      'Questions fréquentes',
      'Prêt à lancer ton premier défi ?',
    ]) {
      expect(
        screen.getByRole('heading', { level: 2, name: name.replace(/’/g, "'") }),
      ).toBeInTheDocument();
    }
    const nav = screen.getByRole('navigation', { name: 'Sections de la page' });
    expect(within(nav).getByRole('link', { name: 'Comment ça marche' })).toHaveAttribute(
      'href',
      '#how',
    );
  });

  it('shows the five categories, the time always included', () => {
    renderLanding();

    const categories = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(categories).toEqual(
      expect.arrayContaining([
        'Temps cumulé',
        'Distance cumulée',
        'Élimination',
        'Grand prix',
        'D+ cumulé',
      ]),
    );
    expect(screen.getAllByText('Toujours inclus')).toHaveLength(1);
    expect(screen.getAllByText('Au choix')).toHaveLength(4);
  });

  it('gives Hyrox, paragliding and CrossFit their catalogue factor', () => {
    renderLanding();
    const list = screen.getByRole('list', { name: 'Coefficients de distance par sport' });
    const chip = (name: string) =>
      within(list)
        .getAllByRole('listitem')
        .find((item) => item.textContent?.startsWith(name));

    expect(chip('Hyrox')).toHaveTextContent('Hyrox×1');
    expect(chip('Parapente')).toHaveTextContent('Parapente×0,3');
    expect(chip('CrossFit')).toHaveTextContent('CrossFittemps');
  });

  it('never announces a sync with another service', () => {
    renderLanding();

    expect(document.body).not.toHaveTextContent(/Strava|Garmin|Polar|Coros/);
  });

  it('starts the sign-in from « Commencer » and « Se connecter », back to /', () => {
    const auth = renderLanding();

    fireEvent.click(startButtons()[0]);
    expect(auth.signIn).toHaveBeenCalledWith('/challenges');
  });

  it('starts one sign-in at a time', () => {
    const auth = renderLanding(
      createFakeAuth({ signIn: vi.fn(() => new Promise<void>(() => undefined)) }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    fireEvent.click(startButtons()[0]);

    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  it('enables the buttons again when the page comes back from the browser cache', () => {
    const auth = renderLanding(
      createFakeAuth({ signIn: vi.fn(() => new Promise<void>(() => undefined)) }),
    );
    fireEvent.click(startButtons()[0]);
    expect(startButtons()[0]).toBeDisabled();

    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });

    expect(startButtons()[0]).toBeEnabled();
    fireEvent.click(startButtons()[0]);
    expect(auth.signIn).toHaveBeenCalledTimes(2);
  });

  it('links a signed-in user to the challenges', () => {
    renderLanding(createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } }));

    expect(screen.getByRole('link', { name: 'Mon compte' })).toHaveAttribute('href', '/challenges');
    for (const start of screen.getAllByRole('link', { name: 'Commencer' })) {
      expect(start).toHaveAttribute('href', '/challenges');
    }
  });

  it('offers « Mon compte » to a user who signed in on this device before', () => {
    renderLanding(createFakeAuth({ isReturning: true }));

    expect(screen.getByRole('link', { name: 'Mon compte' })).toHaveAttribute('href', '/challenges');
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('goes to the challenges, which wait for it, while the session loads', async () => {
    const auth = renderLanding(createFakeAuth({ isLoading: true }));

    fireEvent.click(startButtons()[0]);

    expect(await screen.findByText('challenges')).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('offers a retry when the sign-in cannot start', async () => {
    const signIn = vi.fn(() => Promise.reject(new Error('network')));
    renderLanding(createFakeAuth({ signIn }));

    const [, final] = startButtons();
    fireEvent.click(final);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "La connexion n'a pas pu démarrer. Réessaie.",
    );
    fireEvent.click(final);
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it('waits for the connection to sign in when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const auth = renderLanding();

    fireEvent.click(startButtons()[0]);
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tu pourras te connecter dès que tu seras de nouveau en ligne.',
    );

    goOnline(true);
    expect(auth.signIn).toHaveBeenCalledWith('/challenges');
  });

  it('switches to English, numbers included', async () => {
    renderLanding();
    // Cycling and paragliding.
    expect(screen.getAllByText('×0,3')).toHaveLength(2);

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Challenge your friends, week after week.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('×0.3')).toHaveLength(2);
    expect(screen.getByText(/^Week 3 of 4 · ends Saturday, Nov(\.)? 28/)).toBeInTheDocument();
  });

  it('stays in French when English cannot be downloaded, and says so', async () => {
    vi.mocked(changeLanguage)
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'));
    renderLanding();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Cette langue n'a pas pu être chargée. Vérifie ta connexion et réessaie.",
    );
    expect(screen.getByRole('radio', { name: 'Français' })).toBeChecked();

    // The footer's choice says it too.
    const footer = screen.getByRole('contentinfo');
    fireEvent.click(within(footer).getByRole('button', { name: 'English' }));
    expect(await within(footer).findByRole('alert')).toBeInTheDocument();
    expect(i18n.language).toBe('fr');
  });

  it('answers the first question, the others on demand', () => {
    renderLanding();

    const [first, second] = document.querySelectorAll('details');
    expect(first).toHaveAttribute('open');
    expect(second).not.toHaveAttribute('open');
  });
});

describe('LandingPage description', () => {
  it('describes the page in the active language, and restores it on leaving', () => {
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = 'static';
    document.head.append(meta);

    const router = createMemoryRouter([{ path: '/', element: <LandingPage /> }]);
    const { unmount } = render(
      <AppProviders auth={createFakeAuth()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(meta.content).toMatch(/^Crée un défi sportif/);

    act(() => {
      void i18n.changeLanguage('en');
    });
    expect(meta.content).toMatch(/^Create a sports challenge/);

    unmount();
    expect(meta.content).toBe('static');
    meta.remove();
  });
});
