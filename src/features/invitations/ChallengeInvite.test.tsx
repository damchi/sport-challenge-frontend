import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { components } from '../../api/generated/schema';
import type { ChallengeDetail } from '../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { ChallengeInvite } from './ChallengeInvite';

type ApiErrorBody = components['schemas']['Error'];

const summary = mockChallenges[1];
if (!summary) throw new Error('No mock challenge');

// A challenge of Montréal whose week 1 ends on Monday 9 November at midnight,
// joined by the user, who may invite.
const base: ChallengeDetail = {
  ...mockChallengeDetail(summary),
  my_role: 'participant',
  my_status: 'active',
  members_can_invite: true,
  registration_deadline: '2026-11-09T05:00:00Z',
};
const beforeDeadline = new Date('2026-11-05T12:00:00Z');
const TOKEN = 'mock-invitation-token';
const link = () => `${window.location.origin}/invite#${TOKEN}`;
const EXPIRES =
  "Valable pour plusieurs personnes jusqu'à la fin de la semaine 1, le lundi 9 novembre à 00 h.";

/** Renders the invitation at `now`, on a device in the given time zone. */
function renderInvite(
  detail: Partial<ChallengeDetail> = {},
  now = beforeDeadline,
  deviceTimeZone = 'America/Montreal',
) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone: deviceTimeZone };
  });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <ChallengeInvite challenge={{ ...base, ...detail }} now={now} />
    </AppProviders>,
  );
}

/** A browser API the test replaces, put back after the test. */
function stubNavigator(name: 'clipboard' | 'share', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

const inviteButton = () => screen.queryByRole('button', { name: 'Inviter des amis' });

async function createLink() {
  fireEvent.click(await screen.findByRole('button', { name: 'Inviter des amis' }));
  return screen.findByRole('textbox', { name: 'Lien à partager' });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(navigator, 'share');
});

describe('ChallengeInvite', () => {
  it('lets the creators invite, even when participants may not', () => {
    renderInvite({ my_role: 'creator', members_can_invite: false });
    expect(inviteButton()).toBeInTheDocument();
  });

  it('lets an active participant invite when the challenge allows it', () => {
    renderInvite();
    expect(inviteButton()).toBeInTheDocument();
  });

  it.each([
    ['participants may not invite', { members_can_invite: false }],
    ['the user abandoned', { my_role: 'abandoned', my_status: 'abandoned' }],
    ['the user is not in', { my_role: 'outsider', my_status: null }],
  ] as const)('shows no invitation when %s', (_case, detail) => {
    renderInvite(detail);
    expect(inviteButton()).not.toBeInTheDocument();
  });

  it('shows no invitation once week 1 has ended', () => {
    renderInvite({ my_role: 'creator' }, new Date('2026-11-09T05:00:00Z'));
    expect(inviteButton()).not.toBeInTheDocument();
  });

  it('creates a link that carries only the token, with its deadline', async () => {
    renderInvite();

    const field = await createLink();
    expect(field).toHaveValue(link());
    expect(field).toHaveFocus();
    expect(screen.getByText(EXPIRES)).toBeInTheDocument();
    expect(inviteButton()).not.toBeInTheDocument();
  });

  it('names the challenge time zone in the deadline when the device is elsewhere', async () => {
    renderInvite({}, beforeDeadline, 'Europe/Paris');

    await createLink();
    // Still the hour of Montréal, not of Paris, and said so.
    expect(screen.getByText(/, le lundi 9 novembre à 00 h, \S/)).toBeInTheDocument();
  });

  it('copies the link to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator('clipboard', { writeText });
    renderInvite();

    await createLink();
    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Lien copié.');
    expect(writeText).toHaveBeenCalledWith(link());
  });

  it('selects the link for a copy by hand when the clipboard fails', async () => {
    stubNavigator('clipboard', { writeText: () => Promise.reject(new Error('denied')) });
    renderInvite();

    const field = await createLink();
    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }));

    expect(await screen.findByText(/Copie impossible/)).toBeInTheDocument();
    expect(field).toHaveFocus();
  });

  it('selects the link when the browser has no clipboard', async () => {
    renderInvite();

    const field = await createLink();
    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }));

    expect(await screen.findByText(/Copie impossible/)).toBeInTheDocument();
    expect(field).toHaveFocus();
  });

  it('offers no share button when the browser cannot share', async () => {
    renderInvite();

    await createLink();
    expect(screen.queryByRole('button', { name: 'Partager' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeInTheDocument();
  });

  it("shares the link with the system's share sheet", async () => {
    const share = vi.fn(() => Promise.resolve());
    stubNavigator('share', share);
    renderInvite();

    await createLink();
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));

    await vi.waitFor(() => {
      expect(share).toHaveBeenCalledWith({
        title: base.title,
        text: `Rejoins-moi dans le défi « ${base.title} »`,
        url: link(),
      });
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('says nothing when the user closes the share sheet', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('Cancelled', 'AbortError')));
    stubNavigator('share', share);
    renderInvite();

    await createLink();
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));

    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('falls back on the copy when sharing fails', async () => {
    stubNavigator('share', () => Promise.reject(new DOMException('Denied', 'NotAllowedError')));
    renderInvite();

    await createLink();
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));

    expect(await screen.findByText('Partage impossible. Copie le lien à la place.')).toBeVisible();
  });

  it.each([
    [403, 'forbidden', "Tu ne peux pas inviter d'amis à ce défi."],
    [
      422,
      'registration_closed',
      'Les inscriptions à ce défi sont closes depuis la fin de la semaine 1.',
    ],
  ] as const)('says why the server refused (%s %s)', async (status, code, message) => {
    server.use(
      http.post('*/api/v1/challenges/:challengeId/invitations', () =>
        HttpResponse.json<ApiErrorBody>({ error: { code, message: 'Refused' } }, { status }),
      ),
    );
    renderInvite();

    fireEvent.click(await screen.findByRole('button', { name: 'Inviter des amis' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('never logs the token', async () => {
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method),
    );
    stubNavigator('clipboard', { writeText: () => Promise.resolve() });
    const share = vi.fn(() => Promise.resolve());
    stubNavigator('share', share);
    renderInvite();

    await createLink();
    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }));
    await screen.findByText('Lien copié.');
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());

    for (const log of logs) {
      expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
    }
  });
});
