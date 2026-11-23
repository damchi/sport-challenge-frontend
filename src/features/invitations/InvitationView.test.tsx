import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail } from '../../api/hooks/useChallenges';
import {
  mockChallengeDetail,
  mockChallenges,
  mockInvitationToken,
  mockInvitedChallengeId,
  mockMe,
} from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { routes } from '../../routes/routes';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';

const found = mockChallenges.find((challenge) => challenge.id === mockInvitedChallengeId);
if (!found) throw new Error('No invited mock challenge');
const summary = found;
const path = `/invite#${mockInvitationToken}`;

// A private challenge of Montréal, open to joining, as an invited user sees it.
const invited: ChallengeDetail = {
  ...mockChallengeDetail(summary),
  visibility: 'private',
  status: 'upcoming',
  my_role: 'invited',
  my_status: null,
  can_join: true,
  participant_count: 3,
};

function answer(detail: Partial<ChallengeDetail> = {}) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () =>
      HttpResponse.json<ChallengeDetail>({ ...invited, ...detail }),
    ),
  );
}

/** Counts the calls to the invitation routes, with the tokens they carried. */
function watchInvitations() {
  const tokens: unknown[] = [];
  server.events.on('request:start', ({ request }) => {
    if (!new URL(request.url).pathname.startsWith('/api/v1/invitations/')) return;
    void request
      .clone()
      .json()
      .then((body: unknown) => tokens.push(body));
  });
  return tokens;
}

function renderAt(entry: string, { signedIn = true, deviceTimeZone = 'America/Montreal' } = {}) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone: deviceTimeZone };
  });
  const auth = createFakeAuth(signedIn ? { isAuthenticated: true, user: { id: 'auth0|1' } } : {});
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, auth };
}

const preview = () => screen.findByRole('region', { name: summary.title });
const accept = () => screen.getByRole('button', { name: "Accepter l'invitation" });

afterEach(() => {
  vi.restoreAllMocks();
  server.events.removeAllListeners();
});

describe('InvitationView', () => {
  it('signs a signed-out user in, then comes back to the invitation', async () => {
    const tokens = watchInvitations();
    const { auth } = renderAt(path, { signedIn: false });

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith(path));
    expect(tokens).toEqual([]);
  });

  it('shows the challenge of the invitation, in its time zone, with the visibility warning', async () => {
    answer();
    renderAt(path, { deviceTimeZone: 'Europe/Paris' });

    const section = within(await preview());
    expect(screen.getByRole('heading', { level: 1, name: 'Invitation' })).toBeInTheDocument();
    expect(section.getByText('Du 2 nov. au 29 nov.')).toBeInTheDocument();
    expect(section.getByText(/^Fuseau du défi : /)).toBeInTheDocument();
    expect(section.getByText('3 participants')).toBeInTheDocument();
    expect(
      section.getByText(
        'Tes activités (date, sport, durée, distance) seront visibles par les autres participants du défi.',
      ),
    ).toBeInTheDocument();
    expect(accept()).toBeInTheDocument();
  });

  it('sends the token in the body, never in the address', async () => {
    const urls: string[] = [];
    const tokens = watchInvitations();
    server.events.on('request:start', ({ request }) => urls.push(request.url));
    answer();
    renderAt(path);

    await preview();
    expect(tokens).toEqual([{ token: mockInvitationToken }]);
    expect(urls.some((url) => url.includes(mockInvitationToken))).toBe(false);
  });

  it('joins only on accept, then opens the challenge', async () => {
    const tokens = watchInvitations();
    answer();
    const { router } = renderAt(path);

    await preview();
    // Opening the link joins nothing.
    expect(tokens).toHaveLength(1);
    fireEvent.click(accept());

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/challenges/${mockInvitedChallengeId}`),
    );
    expect(tokens).toEqual([{ token: mockInvitationToken }, { token: mockInvitationToken }]);
    expect(router.state.location.hash).toBe('');
    // Replaced: the link and its token leave the history.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('opens the challenge on a new history entry: back returns to the invitation', async () => {
    answer();
    const { router } = renderAt(path);

    await preview();
    fireEvent.click(screen.getByRole('link', { name: 'Voir le défi' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/challenges/${mockInvitedChallengeId}`),
    );
    expect(router.state.historyAction).toBe('PUSH');

    await router.navigate(-1);
    expect(router.state.location.pathname).toBe('/invite');
    expect(router.state.location.hash).toBe(`#${mockInvitationToken}`);
    // The invitation can still be accepted.
    await preview();
    expect(accept()).toBeInTheDocument();
  });

  it.each(['', '#', '#not a token', `#${'a'.repeat(257)}`])(
    'says the link is not valid without any call for the fragment %j',
    async (hash) => {
      const tokens = watchInvitations();
      renderAt(`/invite${hash}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Ce lien d'invitation n'est pas valide ou a expiré.",
      );
      expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute(
        'href',
        '/challenges',
      );
      expect(tokens).toEqual([]);
    },
  );

  it('says the link is not valid when the server refuses it', async () => {
    renderAt('/invite#unknown-token');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce lien d'invitation n'est pas valide ou a expiré.",
    );
  });

  it('names no other time zone on a device in the challenge one', async () => {
    answer();
    renderAt(path);

    await preview();
    expect(screen.queryByText(/Fuseau du défi/)).not.toBeInTheDocument();
  });

  it('offers a retry when the link cannot be opened', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/v1/invitations/open', () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({
              challenge_id: summary.id,
              title: summary.title,
              starts_at: summary.starts_at,
              ends_at: summary.ends_at,
            });
      }),
    );
    answer();
    renderAt(path);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await preview()).toBeInTheDocument();
  });

  it('says the link expired when the server refuses the accept', async () => {
    server.use(
      http.post('*/api/v1/invitations/accept', () =>
        HttpResponse.json(
          { error: { code: 'invitation_invalid', message: 'Invalid' } },
          { status: 404 },
        ),
      ),
    );
    answer();
    renderAt(path);

    await preview();
    fireEvent.click(accept());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce lien d'invitation n'est pas valide ou a expiré.",
    );
  });

  it.each([
    [
      422,
      'registration_closed',
      { can_join: false },
      'Les inscriptions sont closes depuis la fin de la semaine 1',
    ],
    [
      422,
      'participation_abandoned',
      { can_join: false, my_status: 'abandoned' as const },
      "Tu as abandonné ce défi : c'est définitif",
    ],
    [
      409,
      'already_participant',
      { can_join: false, my_status: 'active' as const },
      'Tu participes à ce défi.',
    ],
  ])(
    'says why once the reloaded challenge refuses a %i %s',
    async (status, code, reloaded, reason) => {
      let refused = false;
      server.use(
        http.post('*/api/v1/invitations/accept', () => {
          refused = true;
          return HttpResponse.json({ error: { code, message: 'No' } }, { status });
        }),
        http.get('*/api/v1/challenges/:challengeId', () =>
          HttpResponse.json<ChallengeDetail>({ ...invited, ...(refused ? reloaded : {}) }),
        ),
      );
      renderAt(path);

      await preview();
      fireEvent.click(accept());

      // Once the challenge has reloaded, its reason says why, in place of the error.
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(reason));
      const alert = screen.getByRole('alert');
      // The button is gone: the focus moves to the reason.
      expect(alert).toHaveFocus();
      expect(
        screen.queryByRole('button', { name: "Accepter l'invitation" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Voir le défi' })).toHaveAttribute(
        'href',
        `/challenges/${mockInvitedChallengeId}`,
      );
    },
  );

  it('says why at once when the challenge is already closed to joining', async () => {
    answer({ can_join: false });
    renderAt(path);

    const section = within(await preview());
    expect(
      section.getByText('Les inscriptions sont closes depuis la fin de la semaine 1', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(section.queryByRole('button')).not.toBeInTheDocument();
    expect(section.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the button to try again after a server error', async () => {
    server.use(
      http.post('*/api/v1/invitations/accept', () => new HttpResponse(null, { status: 503 })),
    );
    answer();
    renderAt(path);

    await preview();
    fireEvent.click(accept());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    expect(accept()).toBeInTheDocument();
  });

  it('sends an incomplete profile to onboarding, then back to the invitation', async () => {
    let complete = true;
    server.use(
      http.get('*/api/v1/me', () =>
        HttpResponse.json(
          complete
            ? mockMe
            : { ...mockMe, first_name: null, last_name: null, profile_complete: false },
        ),
      ),
      http.post('*/api/v1/invitations/accept', () => {
        complete = false;
        return HttpResponse.json(
          { error: { code: 'profile_incomplete', message: 'Incomplete' } },
          { status: 422 },
        );
      }),
      http.patch('*/api/v1/me', () => {
        complete = true;
        return HttpResponse.json(mockMe);
      }),
    );
    answer();
    const { router } = renderAt(path);

    await preview();
    fireEvent.click(accept());

    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    fireEvent.change(await screen.findByLabelText('Prénom'), { target: { value: 'Marie' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Tremblay' } });
    fireEvent.click(screen.getByRole('button', { name: "C'est parti" }));

    expect(await preview()).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/invite');
    expect(router.state.location.hash).toBe(`#${mockInvitationToken}`);
  });
});
