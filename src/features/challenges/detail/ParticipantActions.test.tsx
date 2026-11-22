import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail, Participant } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { routes } from '../../../routes/routes';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;
const id = summary.id;
const path = `/challenges/${id}/participants`;

const SAM = '10000000-0000-4000-8000-000000000001';
const LEA = '10000000-0000-4000-8000-000000000002';
const JO = '10000000-0000-4000-8000-000000000003';

// An ongoing challenge created by the user.
function answer(detail: Partial<ChallengeDetail> = {}) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () =>
      HttpResponse.json<ChallengeDetail>({
        ...mockChallengeDetail(summary),
        status: 'ongoing',
        my_role: 'creator',
        my_status: 'active',
        can_join: false,
        ...detail,
      }),
    ),
  );
}

function participant(overrides: Partial<Participant>): Participant {
  return {
    user_id: SAM,
    pseudo: 'sam',
    first_name: 'Sam',
    last_name: 'Roy',
    avatar: null,
    status: 'active',
    is_creator: false,
    joined_at: '2026-11-02T15:00:00Z',
    ...overrides,
  };
}

// Sam, active; Léa, a creator; Jo, who abandoned.
const people = [
  participant({}),
  participant({ user_id: LEA, pseudo: 'lea', is_creator: true }),
  participant({ user_id: JO, pseudo: 'jo', status: 'abandoned' }),
];

function listing(items: Participant[]) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId/participants', () =>
      HttpResponse.json({ items, next_cursor: null }),
    ),
  );
}

function renderAt() {
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </AppProviders>,
  );
}

const list = () => screen.findByRole('region', { name: 'Participants du défi' });
const rowOf = async (name: string) => {
  const rows = within(await list()).getAllByRole('listitem');
  const row = rows.find((item) => within(item).queryByText(name));
  if (!row) throw new Error(`No row for ${name}`);
  return row;
};

describe('ParticipantActions', () => {
  it('offers both actions on active participants who are not creators only', async () => {
    answer();
    listing(people);
    renderAt();

    const sam = await rowOf('sam');
    expect(
      within(sam).getByRole('button', { name: 'Ajouter comme créateur sam' }),
    ).toBeInTheDocument();
    expect(within(sam).getByRole('button', { name: 'Exclure sam' })).toBeInTheDocument();
    const lea = await rowOf('lea');
    expect(within(lea).getByText('Créateur')).toBeInTheDocument();
    expect(within(lea).queryByRole('button')).not.toBeInTheDocument();
    expect(within(await rowOf('jo')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps both actions for a creator who abandoned', async () => {
    answer({ my_status: 'abandoned' });
    listing(people);
    renderAt();

    expect(
      within(await rowOf('sam')).getByRole('button', { name: 'Exclure sam' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['a participant', { my_role: 'participant' }],
    ['the creators of a finished challenge', { status: 'finished' }],
  ] as const)('offers no action to %s', async (_, detail) => {
    answer(detail);
    listing(people);
    renderAt();

    expect(within(await rowOf('sam')).queryByRole('button')).not.toBeInTheDocument();
  });

  describe('excluding', () => {
    let excluded: string[] = [];
    beforeEach(() => {
      excluded = [];
      answer();
      listing(people);
    });

    function excludeAnswers(response: () => Response) {
      server.use(
        http.delete('*/api/v1/challenges/:challengeId/participants/:userId', ({ params }) => {
          excluded.push(String(params.userId));
          return response();
        }),
      );
    }

    it('asks for a confirmation that says it is final', async () => {
      excludeAnswers(() => new HttpResponse(null, { status: 204 }));
      renderAt();
      fireEvent.click(within(await rowOf('sam')).getByRole('button', { name: 'Exclure sam' }));

      const dialog = screen.getByRole('dialog', { name: 'Exclure sam ?' });
      expect(dialog).toHaveAccessibleDescription(
        "C'est définitif : cette personne est éliminée de toutes les catégories et apparaît « A abandonné » dans les classements, hors podium. Elle ne pourra plus rejoindre ce défi.",
      );
      // A final action: the confirmation is red.
      expect(within(dialog).getByRole('button', { name: 'Exclure' })).toHaveClass('bg-danger');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(excluded).toEqual([]);
    });

    it('excludes on confirmation, then lists them as abandoned', async () => {
      excludeAnswers(() => new HttpResponse(null, { status: 204 }));
      renderAt();
      fireEvent.click(within(await rowOf('sam')).getByRole('button', { name: 'Exclure sam' }));
      listing([participant({ status: 'abandoned' }), ...people.slice(1)]);
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Exclure' }));

      const outcome = await within(await list()).findByRole('status');
      expect(outcome).toHaveTextContent('sam ne participe plus au défi.');
      expect(outcome).toHaveFocus();
      expect(excluded).toEqual([SAM]);
      await waitFor(async () =>
        expect(within(await rowOf('sam')).getByText('A abandonné')).toBeInTheDocument(),
      );
      expect(screen.queryByRole('button', { name: 'Exclure sam' })).not.toBeInTheDocument();
    });

    it('sends the exclusion once while it is sent', async () => {
      let release: () => void = () => undefined;
      const sent = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.delete('*/api/v1/challenges/:challengeId/participants/:userId', async ({ params }) => {
          excluded.push(String(params.userId));
          await sent;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      renderAt();
      fireEvent.click(within(await rowOf('sam')).getByRole('button', { name: 'Exclure sam' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Exclure' }));

      const busy = await screen.findByRole('button', { name: 'Exclusion…' });
      expect(busy).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(busy);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(excluded).toEqual([SAM]);
      release();
      expect(await within(await list()).findByRole('status')).toHaveTextContent(
        'sam ne participe plus au défi.',
      );
    });

    it.each([
      ['cannot_exclude_creator', 422, 'Un créateur ne peut pas être exclu du défi.'],
      ['challenge_ended', 422, 'Ce défi est terminé.'],
      ['not_found', 404, 'Cette personne ne participe plus à ce défi.'],
    ])('translates the refusal %s', async (code, status, message) => {
      excludeAnswers(() => HttpResponse.json({ error: { code, message: 'raw' } }, { status }));
      renderAt();
      fireEvent.click(within(await rowOf('sam')).getByRole('button', { name: 'Exclure sam' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Exclure' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert).not.toHaveTextContent('raw');
    });
  });

  describe('adding a creator', () => {
    let added: unknown[] = [];
    beforeEach(() => {
      added = [];
      answer();
      listing(people);
    });

    function addAnswers(response: () => Response) {
      server.use(
        http.post('*/api/v1/challenges/:challengeId/creators', async ({ request }) => {
          added.push(await request.json());
          return response();
        }),
      );
    }

    it('makes the participant a creator on confirmation', async () => {
      addAnswers(() =>
        HttpResponse.json<ChallengeDetail>({
          ...mockChallengeDetail(summary),
          my_role: 'creator',
        }),
      );
      renderAt();
      fireEvent.click(
        within(await rowOf('sam')).getByRole('button', { name: 'Ajouter comme créateur sam' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Ajouter sam comme créateur ?' });
      expect(dialog).toHaveAccessibleDescription(
        "Cette personne pourra, comme toi, modifier le titre et la description, inviter des amis, ajouter d'autres créateurs, exclure des participants et supprimer le défi.",
      );
      // Not a final action: the confirmation keeps the main style.
      expect(within(dialog).getByRole('button', { name: 'Ajouter comme créateur' })).toHaveClass(
        'bg-accent',
      );
      listing([participant({ is_creator: true }), ...people.slice(1)]);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter comme créateur' }));

      const outcome = await within(await list()).findByRole('status');
      expect(outcome).toHaveTextContent('sam a maintenant les droits de créateur.');
      expect(added).toEqual([{ user_id: SAM }]);
      await waitFor(async () =>
        expect(within(await rowOf('sam')).getByText('Créateur')).toBeInTheDocument(),
      );
      expect(screen.queryByRole('button', { name: 'Exclure sam' })).not.toBeInTheDocument();
    });

    it('translates the refusal not_active_participant', async () => {
      addAnswers(() =>
        HttpResponse.json(
          { error: { code: 'not_active_participant', message: 'raw' } },
          { status: 422 },
        ),
      );
      renderAt();
      fireEvent.click(
        within(await rowOf('sam')).getByRole('button', { name: 'Ajouter comme créateur sam' }),
      );
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Ajouter comme créateur' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Seul un participant actif peut devenir créateur.',
      );
    });
  });
});
