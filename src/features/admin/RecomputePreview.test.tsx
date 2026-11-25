import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type {
  AdminChallengePreview,
  AdminCorrection,
} from '../../api/hooks/admin/useAdminCorrection';
import type { LeaderboardEntry } from '../../api/hooks/useChallenges';
import { mockAdminChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { failure, refreshAll } from '../../test/refresh';
import { createTestQueryClient } from '../../test/render';
import { RecomputePreview } from './RecomputePreview';

const challenge = mockAdminChallenges[0];
if (!challenge) throw new Error('No mock challenge');

// What the change leaves as it was, besides the rankings and eliminations.
const unchanged = {
  title: 'Défi 1',
  status: 'ongoing' as const,
  reference_sport: { before: 'run', after: 'run' },
  results: null,
  weeks: [],
  points: [],
};

function entry(
  pseudo: string,
  rank: number | null,
  value: number | null,
  more: Partial<LeaderboardEntry> = {},
): LeaderboardEntry {
  return {
    rank,
    user: { id: `id-${pseudo}`, pseudo, first_name: null, last_name: null, avatar: null },
    value,
    abandoned: rank === null,
    elimination: null,
    provisional_points: null,
    ...more,
  };
}

function ranking(entries: LeaderboardEntry[]) {
  return {
    computed_at: '2026-11-24T12:00:00Z',
    categories: [
      {
        type: 'cumulative_time' as const,
        ranked_count: entries.filter((line) => !line.abandoned).length,
        podium: null,
        entries,
        me: null,
        next_cursor: null,
      },
    ],
  };
}

function renderPreview(challenges: AdminChallengePreview[], queryClient = createTestQueryClient()) {
  const correction: AdminCorrection = { dry_run: true, challenges };
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  render(
    <AppProviders auth={auth} queryClient={queryClient}>
      <RecomputePreview correction={correction} />
    </AppProviders>,
  );
}

/** A category's card, by its name, once the challenge's sheet is read. */
async function category(name: string) {
  const heading = await screen.findByRole('heading', { level: 4, name });
  const card = heading.closest('section');
  if (!card) throw new Error(`No category ${name}`);
  return card;
}

/** The cells of a row, by the participant's name, spaces made plain. */
function row(card: HTMLElement, name: string) {
  const line = within(card).getByRole('rowheader', { name }).closest('tr');
  if (!line) throw new Error(`No row ${name}`);
  return within(line)
    .getAllByRole('cell')
    .map((cell) => cell.textContent?.replace(/\s/gu, ' '));
}

describe('RecomputePreview', () => {
  it('shows the ranks that move, said in words, ties at the same rank', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: ranking([
          entry('ami_1', 1, 7200),
          entry('ami_2', 2, 3600),
          entry('ami_3', 3, 1800),
          entry('ami_9', 4, 600),
        ]),
        after: ranking([
          entry('ami_2', 1, 7200),
          entry('ami_3', 1, 7200),
          entry('ami_1', 3, 7200),
          entry('ami_9', 4, 600),
        ]),
        eliminations: [],
      },
    ]);

    expect(await screen.findByRole('heading', { level: 3, name: 'Défi 1' })).toBeInTheDocument();
    const card = await category('Temps cumulé');
    expect(
      within(card)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Participant', 'Rang', 'Avant', 'Après']);
    expect(row(card, 'ami_2')).toEqual(['Monte : 2e à 1er ex æquo', '1:00', '2:00']);
    expect(row(card, 'ami_3')).toEqual(['Monte : 3e à 1er ex æquo', '0:30', '2:00']);
    expect(row(card, 'ami_1')).toEqual(['Descend : 1er à 3e', '2:00', '2:00']);
    // The one whose value changes stands out; ami_9 does not move.
    expect(within(card).getByRole('rowheader', { name: 'ami_2' }).closest('tr')).toHaveClass(
      'bg-accent-soft',
    );
    expect(within(card).getByRole('rowheader', { name: 'ami_1' }).closest('tr')).not.toHaveClass(
      'bg-accent-soft',
    );
    expect(within(card).queryByRole('rowheader', { name: 'ami_9' })).not.toBeInTheDocument();
    expect(within(card).getByText('Les autres rangs ne bougent pas.')).toBeInTheDocument();
  });

  it('says who leaves the ranking, and a category where nothing changes', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: ranking([entry('ami_1', 1, 7200), entry('ami_2', 2, 3600)]),
        after: ranking([entry('ami_2', 1, 3600), entry('ami_1', null, null)]),
        eliminations: [],
      },
      {
        challenge_id: mockAdminChallenges[1]?.id ?? '',
        ...unchanged,
        before: ranking([entry('ami_1', 1, 7200)]),
        after: ranking([entry('ami_1', 1, 7200)]),
        eliminations: [],
      },
    ]);

    await screen.findByRole('heading', { level: 3, name: 'Défi 2' });
    await screen.findByRole('heading', { level: 3, name: 'Défi 1' });
    const [first, second] = screen.getAllByRole('heading', { level: 4, name: 'Temps cumulé' });
    const card = first?.closest('section');
    if (!card || !second) throw new Error('No categories');
    expect(row(card, 'ami_1')).toEqual(['Sort du classement : 1erA abandonné', '2:00', '—']);
    expect(row(card, 'ami_2')).toEqual(['Monte : 2e à 1er', '1:00', '1:00']);
    expect(
      within(second.closest('section') ?? document.body).getByText(
        'Aucun rang ni aucune valeur ne change.',
      ),
    ).toBeInTheDocument();
  });

  it('says who enters the ranking, and hides a line whose shown value does not change', async () => {
    const out = { eliminated_week: 2 } as LeaderboardEntry['elimination'];
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: ranking([
          entry('ami_1', 1, 7200),
          entry('ami_2', null, null),
          entry('ami_3', 2, 600, { elimination: out }),
        ]),
        after: ranking([
          entry('ami_1', 1, 7200),
          entry('ami_2', 2, 3600, { abandoned: false }),
          entry('ami_3', 3, 900, { elimination: out }),
        ]),
        eliminations: [],
      },
    ]);

    const card = await category('Temps cumulé');
    expect(row(card, 'ami_2')).toEqual(['Entre dans le classement : A abandonné2e', '—', '1:00']);
    // Eliminated before and after: no value shown, so nothing to show.
    expect(within(card).queryByRole('rowheader', { name: 'ami_3' })).not.toBeInTheDocument();
  });

  it('says an elimination moved to another week, or changed in the same one', async () => {
    const user = (pseudo: string) => ({
      id: `id-${pseudo}`,
      pseudo,
      first_name: null,
      last_name: null,
    });
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: ranking([entry('ami_1', 1, 7200)]),
        after: ranking([entry('ami_1', 1, 7200)]),
        eliminations: [
          {
            user: user('ami_5'),
            before: { week_number: 2, distance_meters: 8000, required_meters: 10_000 },
            after: { week_number: 3, distance_meters: 9000, required_meters: 12_000 },
          },
          {
            user: user('ami_6'),
            before: { week_number: 3, distance_meters: 5000, required_meters: 12_000 },
            after: { week_number: 3, distance_meters: 6000, required_meters: 12_000 },
          },
        ],
      },
    ]);

    const moved = (await screen.findByText(/ami_5 est éliminé en semaine 3/u)).closest('li');
    expect(moved?.textContent?.replace(/\s/gu, ' ')).toBe(
      'Élimination : ami_5 est éliminé en semaine 3 au lieu de la semaine 2. 9 km pour un minimum de 12 km.',
    );
    const kept = screen.getByText(/ami_6 reste éliminé en semaine 3/u).closest('li');
    expect(kept?.textContent?.replace(/\s/gu, ' ')).toBe(
      'Élimination : ami_6 reste éliminé en semaine 3. Avant : 5 km pour un minimum de 12 km. Après : 6 km pour un minimum de 12 km.',
    );
  });

  it('says the eliminations that change, by words and colour', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: ranking([entry('ami_1', 1, 7200)]),
        after: ranking([entry('ami_1', 1, 7200)]),
        eliminations: [
          {
            user: { id: 'id-ami_5', pseudo: 'ami_5', first_name: null, last_name: null },
            before: { week_number: 2, distance_meters: 8000, required_meters: 10_000 },
            after: null,
          },
          {
            user: { id: 'id-ami_6', pseudo: 'ami_6', first_name: null, last_name: null },
            before: null,
            after: { week_number: 3, distance_meters: 5000, required_meters: 12_000 },
          },
        ],
      },
    ]);

    const removed = (await screen.findByText(/ami_5 n'est plus éliminé en semaine 2/u)).closest(
      'li',
    );
    expect(removed?.textContent?.replace(/\s/gu, ' ')).toBe(
      "Élimination : ami_5 n'est plus éliminé en semaine 2. Distance faite : 8 km pour un minimum de 10 km.",
    );
    expect(removed).toHaveClass('bg-ok-bg');
    const given = screen.getByText(/ami_6 est éliminé en semaine 3/u).closest('li');
    expect(given?.textContent?.replace(/\s/gu, ' ')).toBe(
      'Élimination : ami_6 est éliminé en semaine 3. 5 km pour un minimum de 12 km.',
    );
    expect(given).toHaveClass('bg-risk-bg');
  });

  it('shows the whole ranking after a restore, and says why there is none before', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: null,
        after: ranking([entry('ami_1', 1, 7200)]),
        eliminations: [],
      },
    ]);

    expect(
      await screen.findByText('Pas de classement avant : le défi est supprimé.'),
    ).toBeInTheDocument();
    const card = await category('Temps cumulé');
    expect(
      within(card)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Participant', 'Rang', 'Après']);
    expect(row(card, 'ami_1')).toEqual(['1er', '2:00']);
  });

  it('shows the whole ranking before a deletion, and says why there is none after', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: ranking([entry('ami_1', 1, 7200)]),
        after: null,
        eliminations: [],
      },
    ]);

    expect(
      await screen.findByText('Pas de classement après : le défi sera supprimé.'),
    ).toBeInTheDocument();
    const card = await category('Temps cumulé');
    expect(
      within(card)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Participant', 'Rang', 'Avant']);
    expect(row(card, 'ami_1')).toEqual(['1er', '2:00']);
  });

  it('never makes up a rank the server does not give', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: ranking([entry('ami_1', 1, 7200)]),
        after: ranking([entry('ami_1', null, 7200, { abandoned: false })]),
        eliminations: [],
      },
    ]);

    const card = await category('Temps cumulé');
    expect(row(card, 'ami_1')[0]).toBe('Sort du classement : 1erPas dans le classement');
  });

  it("waits for the challenge's sheet, then offers to read it again when it fails", async () => {
    let fail = true;
    server.use(
      http.get('*/api/v1/admin/challenges/:challengeId', () =>
        fail
          ? HttpResponse.json(
              { error: { code: 'internal_error', message: 'Boom' } },
              { status: 500 },
            )
          : undefined,
      ),
    );
    renderPreview([
      {
        challenge_id: challenge.id,
        ...unchanged,
        before: ranking([entry('ami_1', 1, 7200)]),
        after: ranking([entry('ami_1', 1, 9000)]),
        eliminations: [],
      },
    ]);

    expect(screen.getByRole('status')).toBeInTheDocument();
    const retry = await screen.findByRole('button', { name: 'Réessayer' });
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(retry);

    expect(await screen.findByRole('heading', { level: 3, name: 'Défi 1' })).toBeInTheDocument();
  });

  it('says when the change touches no ranking', () => {
    renderPreview([]);

    expect(screen.getByText('Cette modification ne touche aucun classement.')).toBeInTheDocument();
  });

  it.each([500, 429] as const)(
    "keeps the challenge's card when reading its sheet again fails (%i)",
    async (status) => {
      const queryClient = createTestQueryClient();
      renderPreview(
        [
          {
            challenge_id: challenge.id,
            ...unchanged,
            before: ranking([entry('ami_1', 1, 7200)]),
            after: ranking([entry('ami_1', 1, 9000)]),
            eliminations: [],
          },
        ],
        queryClient,
      );
      await screen.findByRole('heading', { level: 3, name: 'Défi 1' });

      server.use(http.get('*/api/v1/admin/challenges/:challengeId', () => failure(status)));
      await refreshAll(queryClient);

      expect(screen.getByRole('heading', { level: 3, name: 'Défi 1' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    },
  );
});
