import { render, screen, within } from '@testing-library/react';
import type {
  AdminChallengePreview,
  AdminCorrection,
} from '../../api/hooks/admin/useAdminCorrection';
import type { LeaderboardEntry } from '../../api/hooks/useChallenges';
import { mockAdminChallenges } from '../../mocks/handlers';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { RecomputePreview } from './RecomputePreview';

const challenge = mockAdminChallenges[0];
if (!challenge) throw new Error('No mock challenge');

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

function renderPreview(challenges: AdminChallengePreview[]) {
  const correction: AdminCorrection = { dry_run: true, challenges };
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  render(
    <AppProviders auth={auth}>
      <RecomputePreview correction={correction} />
    </AppProviders>,
  );
}

/** The cells of a row, by the participant's name. */
function row(table: HTMLElement, name: string) {
  const header = within(table).getByRole('rowheader', { name });
  const line = header.closest('tr');
  if (!line) throw new Error(`No row ${name}`);
  return within(line)
    .getAllByRole('cell')
    .map((cell) => cell.textContent?.replace(/\s/gu, ' '));
}

describe('RecomputePreview', () => {
  it('shows each ranking before and after, the moves said in words, ties at the same rank', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        before: ranking([
          entry('ami_1', 1, 7200),
          entry('ami_2', 2, 3600),
          entry('ami_3', 3, 1800),
        ]),
        after: ranking([
          entry('ami_2', 1, 7200),
          entry('ami_3', 1, 7200),
          entry('ami_1', 3, 3600),
          entry('ami_4', null, null),
        ]),
        eliminations: [],
      },
    ]);

    expect(await screen.findByRole('heading', { level: 3, name: 'Défi 1' })).toBeInTheDocument();
    const table = screen.getByRole('region', { name: 'Défi 1 · Temps cumulé' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Participant', 'Avant', 'Après', 'Évolution']);
    expect(row(table, 'ami_2')).toEqual(['21:00', '1 ex æquo2:00', "↑ Monte d'une place"]);
    expect(row(table, 'ami_3')).toEqual(['30:30', '1 ex æquo2:00', '↑ Monte de 2 places']);
    expect(row(table, 'ami_1')).toEqual(['12:00', '31:00', '↓ Descend de 2 places']);
    expect(row(table, 'ami_4')).toEqual(['Pas dans le classement', 'A abandonné', '= Inchangé']);
    // The arrow is for the eye: the words say the move.
    for (const arrow of within(table).getAllByText(/^[↑↓=]$/u)) {
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('shows the eliminations that change, one cancelled', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        before: ranking([entry('ami_1', 1, 7200)]),
        after: ranking([entry('ami_1', 1, 7200)]),
        eliminations: [
          {
            user: { id: 'id-ami_5', pseudo: 'ami_5', first_name: null, last_name: null },
            before: { week_number: 3, distance_meters: 8000, required_meters: 10_000 },
            after: null,
          },
        ],
      },
    ]);

    const table = await screen.findByRole('region', {
      name: 'Défi 1 · Éliminations qui changent',
    });
    expect(row(table, 'ami_5')).toEqual(['Semaine 38 km sur 10 km', 'Pas éliminé']);
  });

  it('shows only the ranking after a restore, and says why', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        before: null,
        after: ranking([entry('ami_1', 1, 7200)]),
        eliminations: [],
      },
    ]);

    expect(
      await screen.findByText('Pas de classement avant : le défi est supprimé.'),
    ).toBeInTheDocument();
    const table = await screen.findByRole('region', { name: 'Défi 1 · Temps cumulé' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Participant', 'Après']);
  });

  it('shows only the ranking before a deletion, and says why', async () => {
    renderPreview([
      {
        challenge_id: challenge.id,
        before: ranking([entry('ami_1', 1, 7200)]),
        after: null,
        eliminations: [],
      },
    ]);

    expect(
      await screen.findByText('Pas de classement après : le défi sera supprimé.'),
    ).toBeInTheDocument();
    const table = await screen.findByRole('region', { name: 'Défi 1 · Temps cumulé' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Participant', 'Avant']);
    expect(row(table, 'ami_1')).toEqual(['12:00']);
  });

  it('says when the change touches no ranking', () => {
    renderPreview([]);

    expect(screen.getByText('Cette modification ne touche aucun classement.')).toBeInTheDocument();
  });
});
