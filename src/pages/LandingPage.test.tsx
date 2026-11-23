import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Auth } from '../lib/auth/auth';
import { createFakeAuth } from '../test/fakeAuth';
import { AppProviders } from '../test/AppProviders';
import { LandingPage } from './LandingPage';

function renderLanding(auth: Auth = createFakeAuth()) {
  const router = createMemoryRouter([{ path: '/', element: <LandingPage /> }]);
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

  it('never announces a sync with another service', () => {
    renderLanding();

    expect(document.body).not.toHaveTextContent(/Strava|Garmin|Polar|Coros/);
  });

  it('starts the sign-in from « Commencer » and « Se connecter », back to /', () => {
    const auth = renderLanding();

    fireEvent.click(startButtons()[0]);
    expect(auth.signIn).toHaveBeenCalledWith('/');
  });

  it('starts one sign-in at a time', () => {
    const auth = renderLanding(createFakeAuth({ signIn: vi.fn(() => new Promise<void>(() => undefined)) }));

    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    fireEvent.click(startButtons()[0]);

    expect(auth.signIn).toHaveBeenCalledTimes(1);
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
    expect(auth.signIn).toHaveBeenCalledWith('/');
  });

  it('switches to English, numbers included', async () => {
    renderLanding();
    expect(screen.getByText('×0,3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Challenge your friends, week after week.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('×0.3')).toBeInTheDocument();
    expect(document.querySelector('meta[name="description"]')).toBeNull();
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

    unmount();
    expect(meta.content).toBe('static');
    meta.remove();
  });
});
