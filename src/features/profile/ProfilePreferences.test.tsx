import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { mockMe } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ProfilePreferences } from './ProfilePreferences';
import { changeLanguage } from '../../i18n';

// The download of a language's texts, made to fail in some tests.
vi.mock('../../i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../i18n')>();
  return { ...actual, changeLanguage: vi.fn(actual.changeLanguage) };
});

function renderSettings() {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  render(
    <AppProviders auth={auth}>
      <ProfilePreferences />
    </AppProviders>,
  );
}

describe('ProfilePreferences', () => {
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

  it('keeps the language when the other one cannot be downloaded, says so, and saves nothing', async () => {
    let calls = 0;
    server.use(
      http.patch('*/api/v1/me', () => {
        calls += 1;
        return HttpResponse.json(mockMe);
      }),
    );
    vi.mocked(changeLanguage).mockRejectedValueOnce(new Error('offline'));
    renderSettings();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Cette langue n'a pas pu être chargée. Vérifie ta connexion et réessaie.",
    );
    expect(screen.getByRole('radio', { name: 'Français' })).toBeChecked();
    expect(i18n.language).toBe('fr');
    expect(calls).toBe(0);

    // A second try that works applies it and clears the message.
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(calls).toBe(1));
  });

  it('chooses the theme on the device', () => {
    renderSettings();
    expect(screen.getByRole('radio', { name: 'Système' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: 'Sombre' }));

    expect(screen.getByRole('radio', { name: 'Sombre' })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('sport-challenge:theme')).toBe('dark');
  });
});
