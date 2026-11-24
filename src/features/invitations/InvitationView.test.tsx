import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { mockInvitationToken, mockInvitedChallengeId, mockMe } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { routes } from '../../routes/routes';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';

const path = `/invite#${mockInvitationToken}`;
const challengePath = `/challenges/${mockInvitedChallengeId}`;

/** Counts the calls to the invitation routes, with the routes and tokens. */
function watchInvitations() {
  const calls: { route: string; body: unknown }[] = [];
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/v1/invitations/')) return;
    void request
      .clone()
      .json()
      .then((body: unknown) => calls.push({ route: pathname.split('/').pop() ?? '', body }));
  });
  return calls;
}

function refuseAccept(status: number, code: string) {
  server.use(
    http.post('*/api/v1/invitations/accept', () =>
      HttpResponse.json({ error: { code, message: 'No' } }, { status }),
    ),
  );
}

function renderAt(entry: string, { signedIn = true } = {}) {
  const auth = createFakeAuth(signedIn ? { isAuthenticated: true, user: { id: 'auth0|1' } } : {});
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(
    <AppProviders auth={auth}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, auth };
}

const landsOnChallenge = (router: ReturnType<typeof renderAt>['router']) =>
  waitFor(() => expect(router.state.location.pathname).toBe(challengePath));

afterEach(() => {
  server.events.removeAllListeners();
});

describe('InvitationView', () => {
  it('signs a signed-out user in, then comes back to the invitation', async () => {
    const calls = watchInvitations();
    const { auth } = renderAt(path, { signedIn: false });

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith(path));
    expect(calls).toEqual([]);
  });

  it('joins the challenge at once, then opens it in place of the link', async () => {
    const urls: string[] = [];
    const calls = watchInvitations();
    server.events.on('request:start', ({ request }) => urls.push(request.url));
    const { router } = renderAt(path);

    await landsOnChallenge(router);
    // Opened then joined once, the token in the body, never in the address.
    await waitFor(() =>
      expect(calls).toEqual([
        { route: 'open', body: { token: mockInvitationToken } },
        { route: 'accept', body: { token: mockInvitationToken } },
      ]),
    );
    expect(urls.some((url) => url.includes(mockInvitationToken))).toBe(false);
    expect(router.state.location.hash).toBe('');
    // Replaced: the link and its token leave the history.
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByRole('button', { name: "Accepter l'invitation" })).not.toBeInTheDocument();
  });

  it('opens the challenge of a user already in it', async () => {
    refuseAccept(409, 'already_participant');
    const { router } = renderAt(path);

    await landsOnChallenge(router);
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it.each(['', '#', '#not a token', `#${'a'.repeat(257)}`])(
    'says the link is not valid without any call for the fragment %j',
    async (hash) => {
      const calls = watchInvitations();
      renderAt(`/invite${hash}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Ce lien d'invitation n'est pas valide ou a expiré.",
      );
      expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute(
        'href',
        '/challenges',
      );
      expect(calls).toEqual([]);
    },
  );

  it('says the link is not valid when the server refuses it', async () => {
    renderAt('/invite#unknown-token');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce lien d'invitation n'est pas valide ou a expiré.",
    );
  });

  it('says the link expired when the server refuses the join', async () => {
    refuseAccept(404, 'invitation_invalid');
    renderAt(path);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce lien d'invitation n'est pas valide ou a expiré.",
    );
  });

  it.each([
    [
      422,
      'registration_closed',
      'Les inscriptions à ce défi sont closes depuis la fin de la semaine 1.',
    ],
    [422, 'participation_abandoned', 'Tu as abandonné ce défi : tu ne peux plus le rejoindre.'],
  ])('says why a %i %s join is refused, with the way home', async (status, code, reason) => {
    refuseAccept(status, code);
    const { router } = renderAt(path);

    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute(
      'href',
      '/challenges',
    );
    expect(screen.queryByRole('link', { name: 'Voir le défi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/invite');
  });

  it('offers a retry when the link cannot be opened', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/v1/invitations/open', () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({
              challenge_id: mockInvitedChallengeId,
              title: 'Défi',
              starts_at: '2026-11-02T05:00:00Z',
              ends_at: '2026-11-30T05:00:00Z',
            });
      }),
    );
    const { router } = renderAt(path);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await landsOnChallenge(router);
  });

  it('offers a retry for a refusal without a translated code', async () => {
    refuseAccept(403, 'forbidden_somehow');
    renderAt(path);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('offers a retry when the join fails on the server', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/v1/invitations/accept', () => {
        calls += 1;
        // Falls through to the mock's answer the second time.
        return calls === 1 ? new HttpResponse(null, { status: 503 }) : undefined;
      }),
    );
    const { router } = renderAt(path);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await landsOnChallenge(router);
    expect(calls).toBe(2);
  });

  it('sends an incomplete profile to onboarding, then joins', async () => {
    let complete = true;
    let refused = false;
    server.use(
      http.get('*/api/v1/me', () =>
        HttpResponse.json(
          complete
            ? mockMe
            : { ...mockMe, first_name: null, last_name: null, profile_complete: false },
        ),
      ),
      http.post('*/api/v1/invitations/accept', () => {
        if (refused) return undefined;
        refused = true;
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
    const { router } = renderAt(path);

    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    fireEvent.change(await screen.findByLabelText('Prénom'), { target: { value: 'Marie' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Tremblay' } });
    fireEvent.click(screen.getByRole('button', { name: "C'est parti" }));

    await landsOnChallenge(router);
  });
});
