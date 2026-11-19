import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { mockMe } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import type { Auth } from '../../lib/auth/auth';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AppSettings } from './AppSettings';

function renderSettings(overrides: Partial<Auth> = {}) {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' }, ...overrides });
  render(
    <AppProviders auth={auth}>
      <AppSettings />
    </AppProviders>,
  );
  return auth;
}

describe('AppSettings', () => {
  afterEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fr');
  });

  it('switches the language and keeps it in the profile', async () => {
    let sent: unknown;
    server.use(
      http.patch('*/api/v1/me', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...mockMe, language: 'en' });
      }),
    );
    renderSettings();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));

    expect(await screen.findByRole('radio', { name: 'English' })).toBeChecked();
    expect(i18n.language).toBe('en');
    await waitFor(() => expect(sent).toEqual({ language: 'en' }));
  });

  it('says when the language could not be kept, and retries', async () => {
    let calls = 0;
    server.use(
      http.patch('*/api/v1/me', () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ ...mockMe, language: 'en' });
      }),
    );
    renderSettings();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The service is temporarily unavailable.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(calls).toBe(2);
  });

  it('chooses the theme on the device', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('radio', { name: 'Sombre' }));

    expect(screen.getByRole('radio', { name: 'Sombre' })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('sport-challenge:theme')).toBe('dark');
  });

  it('signs out', async () => {
    const auth = renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  });

  it('says when the sign-out could not start, and lets it be tried again', async () => {
    const signOut = vi.fn<Auth['signOut']>().mockRejectedValueOnce(new Error('offline'));
    signOut.mockResolvedValue(undefined);
    renderSettings({ signOut });

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
