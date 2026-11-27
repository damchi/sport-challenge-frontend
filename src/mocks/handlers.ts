import { http, HttpResponse } from 'msw';
import type { components } from '../api/generated/schema';
import { mondayOf } from '../domain/activityWeeks';
import { addToDate, challengeWindow, localDate, zonedMidnight } from '../domain/challengeWindow';
import { answerLeaderboard, type FullRanking } from './leaderboard';

// Mock handlers shared by the tests (src/mocks/server.ts) and the development
// mocks (VITE_MOCKS=true). Each ticket adds the routes it uses, typed by the
// contract. A handler that needs the date reads `new Date()`: its tests fix it
// with vi.setSystemTime, never the real clock (the first such handler adds
// that test).

type SportList = components['schemas']['SportList'];
type Sport = components['schemas']['Sport'];
type Challenge = components['schemas']['Challenge'];
type ChallengeCreate = components['schemas']['ChallengeCreate'];
type Me = components['schemas']['Me'];
type ChallengeSummary = components['schemas']['ChallengeSummary'];
type ChallengePage = components['schemas']['ChallengePage'];
type ChallengeDetail = components['schemas']['ChallengeDetail'];
type ChallengeUpdate = components['schemas']['ChallengeUpdate'];
type Participant = components['schemas']['Participant'];
type ParticipantPage = components['schemas']['ParticipantPage'];
type Leaderboard = components['schemas']['Leaderboard'];
type LeaderboardEntry = components['schemas']['LeaderboardEntry'];
type ApiErrorBody = components['schemas']['Error'];
type Activity = components['schemas']['Activity'];
type ActivityCreate = components['schemas']['ActivityCreate'];
type ActivityPage = components['schemas']['ActivityPage'];
type ChallengeActivityPage = components['schemas']['ChallengeActivityPage'];
type InvitationCreated = components['schemas']['InvitationCreated'];
type AdminStats = components['schemas']['AdminStats'];
type AdminChallengeSummary = components['schemas']['AdminChallengeSummary'];
type AdminChallengeDetail = components['schemas']['AdminChallengeDetail'];
type AdminChallengePage = components['schemas']['AdminChallengePage'];
type AdminUserRef = components['schemas']['AdminUserRef'];
type AdminUser = components['schemas']['AdminUser'];
type AdminUserPage = components['schemas']['AdminUserPage'];
type AdminUserSearch = components['schemas']['AdminUserSearch'];
type AdminUserChallengePage = components['schemas']['AdminUserChallengePage'];
type AdminActivityPage = components['schemas']['AdminActivityPage'];
type AdminAction = components['schemas']['AdminAction'];
type AdminActionPage = components['schemas']['AdminActionPage'];
type AdminCorrection = components['schemas']['AdminCorrection'];
type InvitationPreview = components['schemas']['InvitationPreview'];
type InvitationTokenRequest = components['schemas']['InvitationTokenRequest'];

/** Profile of the mocks: complete, as for most screens; onboarding tests override it. */
export const mockMe: Me = {
  id: '6f1c2a8e-3b5d-4e7f-9a0b-1c2d3e4f5a6b',
  pseudo: 'marie_92',
  first_name: 'Marie',
  last_name: 'Tremblay',
  email: 'marie@example.com',
  avatar: null,
  language: 'fr',
  profile_complete: true,
  is_admin: false,
};

/** Figures of the admin dashboard: every task ran, one failed last. */
export const mockAdminStats: AdminStats = {
  computed_at: '2026-11-24T14:00:00Z',
  accounts: { total: 1284, new_last_7_days: 37, active_last_7_days: 412, blocked: 3 },
  challenges: { upcoming: 6, ongoing: 21, finished: 143, deleted: 4 },
  activities_last_7_days: 1890,
  pending_auth0_deletions: 2,
  blocked_auth0_deletions: 0,
  worker_tasks: [
    {
      task: 'close-weeks',
      last_run: {
        started_at: '2026-11-24T05:00:00Z',
        ended_at: '2026-11-24T05:00:04Z',
        outcome: 'succeeded',
      },
    },
    {
      task: 'finalize-challenges',
      last_run: {
        started_at: '2026-11-24T05:05:00Z',
        ended_at: '2026-11-24T05:05:02Z',
        outcome: 'failed',
        error_code: 'internal_error',
      },
      last_failure: {
        started_at: '2026-11-24T05:05:00Z',
        ended_at: '2026-11-24T05:05:02Z',
        outcome: 'failed',
        error_code: 'internal_error',
      },
    },
    { task: 'retry-auth0-deletions' },
  ],
  build: { version: 'v1.4.0', commit: '0123456789abcdef0123456789abcdef01234567' },
};

type Role = ChallengeSummary['my_role'];

function mockRole(index: number): Role {
  if (index % 6 === 0) return 'creator';
  if (index % 5 === 0) return 'abandoned';
  return index % 2 === 0 ? 'participant' : 'outsider';
}

/** Challenges of the mocks: a few of each kind, enough for two pages. */
export const mockChallenges: ChallengeSummary[] = Array.from({ length: 24 }, (_, index) => {
  const role = mockRole(index);
  const status = index % 3 === 0 ? 'upcoming' : index % 3 === 1 ? 'ongoing' : 'finished';
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    title: `Défi ${index + 1}`,
    visibility: index % 4 === 3 ? 'private' : 'public',
    timezone: 'America/Montreal',
    // The ride challenge (mockRideChallengeId) is run in cycling.
    reference_sport: index === 4 ? 'ride' : 'run',
    starts_at: '2026-11-02T05:00:00Z',
    ends_at: '2026-11-30T05:00:00Z',
    participant_count: (index % 7) + 1,
    my_role: role,
    my_status: role === 'abandoned' ? 'abandoned' : role === 'outsider' ? null : 'active',
    status,
    // Week 3 of 4 when ongoing, as the detail (mockChallengeDetail).
    current_week: status === 'ongoing' ? 3 : null,
    week_ends_at: status === 'ongoing' ? '2026-11-23T05:00:00Z' : null,
    my_week: null,
    week_count: 4,
    // A frozen rank for the active participants of a finished challenge.
    best_result:
      index % 3 === 2 && role !== 'abandoned' && role !== 'outsider'
        ? { type: 'cumulative_distance', rank: 1, ranked_count: (index % 7) + 1 }
        : null,
  };
});

/** A challenge of the mocks run in cycling: distances brought back to the ride. */
export const mockRideChallengeId = '00000000-0000-4000-8000-000000000005';
/** A challenge of the mocks with the cumulative time only. */
export const mockTimeOnlyChallengeId = '00000000-0000-4000-8000-000000000014';

type Category = ChallengeDetail['categories'][number];

function mockCategories(
  challengeId: string,
): Pick<ChallengeDetail, 'reference_sport' | 'categories'> {
  const time: Category = { type: 'cumulative_time', position: 1, params: {} };
  if (challengeId === mockTimeOnlyChallengeId)
    return { reference_sport: 'run', categories: [time] };
  if (challengeId === mockRideChallengeId) {
    return {
      reference_sport: 'ride',
      categories: [
        time,
        {
          type: 'cumulative_distance',
          position: 2,
          params: { factors: { ride: 1, run: 1, rowing: 1, walk: 1 } },
        },
        { type: 'elimination', position: 3, params: { sport: 'ride', step_meters: 10_000 } },
      ],
    };
  }
  return {
    reference_sport: 'run',
    categories: [
      time,
      {
        type: 'cumulative_distance',
        position: 2,
        params: { factors: { run: 1, ride: 0.3, rowing: 0.5, walk: 1 } },
      },
      { type: 'elimination', position: 3, params: { sport: 'run', step_meters: 2000 } },
    ],
  };
}

const PAGE_SIZE = 20;

const mockAdminUser = (index: number): AdminUserRef => ({
  id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  pseudo: `ami_${index}`,
  first_name: 'Ami',
  last_name: String(index),
});

/** Every challenge of the mocks as an admin lists it; the last one is deleted. */
export const mockAdminChallenges: AdminChallengeSummary[] = mockChallenges.map(
  (challenge, index) => ({
    id: challenge.id,
    title: challenge.title,
    visibility: challenge.visibility,
    status: challenge.status,
    timezone: challenge.timezone,
    starts_at: challenge.starts_at,
    ends_at: challenge.ends_at,
    created_at: '2026-10-20T14:00:00Z',
    deleted_at: index === mockChallenges.length - 1 ? '2026-11-20T15:00:00Z' : null,
    participant_count: challenge.participant_count,
    creators: index % 5 === 0 ? [mockAdminUser(1), mockAdminUser(2)] : [mockAdminUser(1)],
  }),
);

/** A challenge as an admin reads it: four weeks, two judged, one elimination. */
export function mockAdminChallengeDetail(summary: AdminChallengeSummary): AdminChallengeDetail {
  const week = (number: number, closed: boolean) => {
    const start = Date.parse('2026-11-02T05:00:00Z') + (number - 1) * 7 * 86_400_000;
    return {
      number,
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(start + 7 * 86_400_000).toISOString(),
      locks_at: new Date(start + 7 * 86_400_000 + 7 * 3_600_000).toISOString(),
      locked: closed,
      closed_at: closed ? new Date(start + 7 * 86_400_000 + 8 * 3_600_000).toISOString() : null,
    };
  };
  return {
    ...summary,
    ...mockCategories(summary.id),
    description: 'Un mois pour courir ensemble.',
    members_can_invite: true,
    weeks: [week(1, true), week(2, true), week(3, false), week(4, false)],
    eliminations: [
      { user: mockAdminUser(3), week_number: 2, distance_meters: 3500, required_meters: 4000 },
    ],
    results_frozen_at: null,
    invitations: [
      {
        id: '20000000-0000-4000-8000-000000000001',
        invited_by: mockAdminUser(1),
        created_at: '2026-10-21T14:00:00Z',
        expires_at: '2026-11-09T05:00:00Z',
        revoked_at: null,
        status: 'expired',
      },
    ],
    recent_actions: [
      {
        id: '30000000-0000-4000-8000-000000000001',
        admin: mockAdminUser(9),
        created_at: '2026-11-18T16:00:00Z',
        action: 'participant.reinstate',
        target_type: 'participant',
        target_id: mockAdminUser(4).id,
        challenge_ids: [summary.id],
        old_value: { status: 'eliminated' },
        new_value: { status: 'active' },
        reason: 'Séance oubliée, vue ensemble',
      },
    ],
  };
}

/** The mock activities of `sport`, or all of them. */
function ofSport(sport: string | null): Activity[] {
  return sport === null
    ? mockActivities
    : mockActivities.filter((activity) => activity.sport_code === sport);
}

/** The totals of the week of `monday` in `timeZone`, as the server gives them. */
function weekTotals(
  monday: string,
  timeZone: string,
  activities: readonly Activity[],
): components['schemas']['ActivityWeek'] {
  const inWeek = activities.filter(
    (activity) => mondayOf(localDate(new Date(activity.started_at), timeZone)) === monday,
  );
  return {
    starts_at: zonedMidnight(monday, timeZone).toISOString(),
    ends_at: zonedMidnight(addToDate(monday, { days: 7 }), timeZone).toISOString(),
    sessions: inWeek.length,
    duration_seconds: inWeek.reduce((sum, activity) => sum + activity.duration_seconds, 0),
    distance_meters: inWeek.reduce((sum, activity) => sum + (activity.distance_meters ?? 0), 0),
    elevation_gain_meters: inWeek.reduce(
      (sum, activity) => sum + (activity.elevation_gain_meters ?? 0),
      0,
    ),
  };
}
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A challenge of the list as the detail route answers it. The server fields
 * are fixed values of November 2026 (week 3 of 4 when ongoing), not
 * computed from the clock: tests that need others override the route.
 */
export function mockChallengeDetail(summary: ChallengeSummary): ChallengeDetail {
  const ongoing = summary.status === 'ongoing';
  return {
    id: summary.id,
    title: summary.title,
    description: 'Un mois pour bouger ensemble.\nToutes les activités comptent.',
    visibility: summary.visibility,
    members_can_invite: true,
    timezone: summary.timezone,
    starts_at: summary.starts_at,
    ends_at: summary.ends_at,
    ...mockCategories(summary.id),
    participant_count: summary.participant_count,
    my_role: summary.my_role,
    my_status: summary.my_status,
    status: summary.status,
    can_join: summary.my_role === 'outsider' && summary.status === 'upcoming',
    registration_deadline: '2026-11-09T05:00:00Z',
    current_week: ongoing ? 3 : null,
    week_ends_at: ongoing ? '2026-11-23T05:00:00Z' : null,
    week_count: 4,
    // Four whole weeks from the start (no time change in them).
    weeks: Array.from({ length: 4 }, (_, index) => ({
      number: index + 1,
      starts_at: new Date(Date.parse(summary.starts_at) + index * WEEK_MS).toISOString(),
      ends_at: new Date(Date.parse(summary.starts_at) + (index + 1) * WEEK_MS).toISOString(),
    })),
  };
}

const PSEUDOS = ['marie_92', 'jean.luc', 'coureuse', 'velo_max', 'sam'];

/**
 * Participants of every mock challenge, enough for two pages, in order of
 * registration: the user first, some who abandoned, one known by their first
 * and last names only, and one without any name.
 */
export const mockParticipants: Participant[] = Array.from({ length: 25 }, (_, index) => ({
  user_id: index === 0 ? mockMe.id : `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  pseudo: index === 7 || index === 11 ? null : `${PSEUDOS[index % PSEUDOS.length]}${index || ''}`,
  first_name: index === 11 ? null : 'Alex',
  last_name: index === 11 ? null : 'Gagnon',
  avatar: null,
  status: index % 4 === 3 ? 'abandoned' : 'active',
  is_creator: index === 0,
  joined_at: new Date(Date.UTC(2026, 10, 2, 14 + index)).toISOString(),
}));

/**
 * The ranking of a category from values given in participant order: best
 * first, equal values sharing a rank (1, 1, 3), the participants who
 * abandoned last, without a rank nor a value.
 */
function mockRanking(type: FullRanking['type'], value: (index: number) => number): FullRanking {
  const user = ({ user_id, pseudo, first_name, last_name, avatar }: Participant) => ({
    id: user_id,
    pseudo,
    first_name,
    last_name,
    avatar,
  });
  const ranked = mockParticipants
    .map((participant, index) => ({ participant, value: value(index) }))
    .filter(({ participant }) => participant.status === 'active')
    .sort((a, b) => b.value - a.value);
  const entries: LeaderboardEntry[] = ranked.map((entry) => ({
    rank: ranked.findIndex((other) => other.value === entry.value) + 1,
    user: user(entry.participant),
    value: entry.value,
    abandoned: false,
    // In the elimination only; outside the weeks of the challenge here.
    elimination:
      type === 'elimination'
        ? {
            status: null,
            eliminated_week: null,
            minimum_meters: null,
            distance_meters: 0,
            week_ends_at: null,
          }
        : null,
    // In the points category only.
    provisional_points: null,
  }));
  for (const participant of mockParticipants.filter((p) => p.status === 'abandoned')) {
    entries.push({
      rank: null,
      user: user(participant),
      value: null,
      abandoned: true,
      elimination: null,
      provisional_points: null,
    });
  }
  return { type, ranked_count: ranked.length, entries };
}

/** `ranking` once `userId` is out of it, as abandoned: the others ranked again. */
function withoutUser(ranking: FullRanking, userId: string): FullRanking {
  const out = (entry: LeaderboardEntry) => entry.abandoned || entry.user.id === userId;
  const ranked = ranking.entries.filter((entry) => !out(entry));
  return {
    ...ranking,
    ranked_count: ranked.length,
    entries: [
      ...ranked.map((entry) => ({
        ...entry,
        rank: ranked.findIndex((other) => other.value === entry.value) + 1,
      })),
      ...ranking.entries.filter(out).map((entry) => ({
        ...entry,
        rank: null,
        value: null,
        abandoned: true,
        elimination: null,
      })),
    ],
  };
}

/** The leaderboard of every mock challenge, with ties in each category. */
const mockLeaderboard = {
  computedAt: '2026-11-18T15:00:00Z',
  categories: [
    // Seconds; the first two are tied.
    mockRanking('cumulative_time', (index) => (index < 2 ? 36_000 : 30_000 - index * 600)),
    // Meters; the second and third are tied.
    mockRanking('cumulative_distance', (index) => 52_300 - Math.max(index, 2) * 1_000),
    mockRanking('elimination', (index) => 30_000 - index * 750),
  ],
};

const MOCK_SPORTS = [
  { sport_code: 'run', sport_label: null, distance_meters: 8200, elevation_gain_meters: 85 },
  { sport_code: 'yoga', sport_label: null, distance_meters: null, elevation_gain_meters: null },
  { sport_code: 'other', sport_label: 'Padel', distance_meters: null, elevation_gain_meters: null },
  { sport_code: 'ride', sport_label: null, distance_meters: 31_500, elevation_gain_meters: null },
] as const;

/**
 * Activities of the user, one a day back from 19 November 2026, enough for
 * two pages: the five most recent are in the current week, the others in
 * weeks that have ended (locked).
 */
export const mockActivities: Activity[] = Array.from({ length: 24 }, (_, index) => {
  const sport = MOCK_SPORTS[index % MOCK_SPORTS.length] ?? MOCK_SPORTS[0];
  const duration = 2700 + index * 60;
  const distance = sport.distance_meters;
  const locked = index >= 5;
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(10, '0')}a1`,
    ...sport,
    started_at: new Date(Date.UTC(2026, 10, 19 - index, 12, 30)).toISOString(),
    duration_seconds: duration,
    source: 'manual',
    speed_mps: distance === null ? null : distance / duration,
    pace_seconds_per_km: distance === null ? null : duration / (distance / 1000),
    contributions: [
      {
        challenge_id: '00000000-0000-4000-8000-000000000002',
        challenge_title: 'Défi 2',
        distance_meters: distance,
        duration_seconds: duration,
      },
    ],
    locked,
  };
});

/** The token of the link the mocks create, and the challenge it leads to (private, upcoming). */
export const mockInvitationToken = 'mock-invitation-token';
export const mockInvitedChallengeId = '00000000-0000-4000-8000-000000000004';

function invitationInvalid() {
  const body: ApiErrorBody = {
    error: { code: 'invitation_invalid', message: 'Invitation invalid' },
  };
  return HttpResponse.json(body, { status: 404 });
}

function activityNotFound() {
  const body: ApiErrorBody = {
    error: { code: 'activity_not_found', message: 'Activity not found' },
  };
  return HttpResponse.json(body, { status: 404 });
}

/**
 * Every account as an admin lists it, enough for two pages: the first is the
 * profile of the mocks; the second has no pseudo; the third is deleted, the
 * fourth waits for its deletion at Auth0.
 */
export const mockAdminUsers: AdminUser[] = Array.from({ length: 24 }, (_, index) => {
  const created_at = new Date(Date.UTC(2026, 10, 20 - index, 14)).toISOString();
  const base = {
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    created_at,
    deleted_at: null,
    last_activity_at: index % 2 === 0 ? '2026-11-19T12:30:00Z' : null,
    challenge_count: index % 4,
  };
  if (index === 0) {
    return {
      ...base,
      pseudo: mockMe.pseudo,
      first_name: mockMe.first_name,
      last_name: mockMe.last_name,
      email: mockMe.email,
      state: 'active',
      challenge_count: mockAdminChallenges.length,
    };
  }
  if (index === 2 || index === 3) {
    return {
      ...base,
      pseudo: null,
      first_name: null,
      last_name: null,
      email: null,
      state: index === 2 ? 'deleted' : 'auth0_deletion_pending',
      deleted_at: '2026-11-21T10:00:00Z',
      last_activity_at: null,
      challenge_count: 0,
    };
  }
  return {
    ...base,
    pseudo: index === 1 ? null : `ami_${index}`,
    first_name: 'Ami',
    last_name: String(index),
    email: `ami${index}@example.com`,
    state: 'active',
  };
});

/**
 * The journal, most recent first, enough for two pages: settings changed on
 * the first challenge, then one change of each kind of target (one an hour
 * before the other), the activity counting in two challenges.
 */
export const mockAdminActions: AdminAction[] = Array.from({ length: 24 }, (_, index) => {
  const challenge = mockAdminChallenges[index % mockAdminChallenges.length]?.id ?? '';
  const base = {
    id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    admin: mockAdminUser(9),
    created_at: new Date(Date.UTC(2026, 10, 20, 16 - index)).toISOString(),
    challenge_ids: [challenge],
    reason: `Correction ${index + 1}`,
  };
  switch (index % 4) {
    case 1:
      return {
        ...base,
        action: 'participant.exclude',
        target_type: 'participant',
        target_id: mockAdminUsers[1]?.id ?? '',
        old_value: { status: 'active' },
        new_value: { status: 'excluded' },
      };
    case 2:
      return {
        ...base,
        action: 'activity.delete',
        target_type: 'activity',
        target_id: mockActivities[0]?.id ?? '',
        challenge_ids: [challenge, mockAdminChallenges[1]?.id ?? ''],
        old_value: { duration_seconds: 3600, sport_code: 'run' },
        new_value: null,
      };
    case 3:
      return {
        ...base,
        action: 'user.update',
        target_type: 'user',
        target_id: mockAdminUsers[4]?.id ?? '',
        challenge_ids: [],
        old_value: { pseudo: 'ami_4' },
        new_value: { pseudo: 'ami_quatre' },
      };
    default:
      return {
        ...base,
        action: 'challenge.update',
        target_type: 'challenge',
        target_id: challenge,
        old_value: { title: 'Avant', registration_deadline: null },
        new_value: { title: 'Après', registration_deadline: '2026-11-30T05:00:00Z' },
      };
  }
});

/** The answer of a 404 for an account. */
const userNotFound = () => {
  const body: ApiErrorBody = { error: { code: 'user_not_found', message: 'User not found' } };
  return HttpResponse.json(body, { status: 404 });
};

/** A page of `items` from the cursor (the index of the next item) and limit of `query`. */
function mockPage<T>(items: T[], cursor: string | null | undefined, limit: number | null) {
  const from = Number(cursor ?? 0);
  const size = limit ?? PAGE_SIZE;
  const page = items.slice(from, from + size);
  return { items: page, next_cursor: from + size < items.length ? String(from + size) : null };
}

// The catalogue's sports have no exercise yet in the mocks.
function withoutExercises(sports: Omit<Sport, 'exercises'>[]): Sport[] {
  return sports.map((sport) => ({ ...sport, exercises: [] }));
}

export const handlers = [
  http.get('*/api/v1/me', () => HttpResponse.json<Me>(mockMe)),
  http.delete('*/api/v1/me', () => new HttpResponse(null, { status: 204 })),
  http.get('*/api/v1/admin/stats', () => HttpResponse.json<AdminStats>(mockAdminStats)),
  // Newest first in the API; the mocks keep their order. The cursor is the
  // index of the next item.
  http.get('*/api/v1/admin/challenges', ({ request }) => {
    const query = new URL(request.url).searchParams;
    const q = query.get('q')?.toLocaleLowerCase();
    const deleted = query.get('deleted');
    const filtered = mockAdminChallenges.filter(
      (challenge) =>
        (!q || challenge.title.toLocaleLowerCase().includes(q)) &&
        (!query.get('status') || challenge.status === query.get('status')) &&
        (!query.get('visibility') || challenge.visibility === query.get('visibility')) &&
        (deleted === null || (challenge.deleted_at !== null) === (deleted === 'true')),
    );
    const from = Number(query.get('cursor') ?? 0);
    const size = Number(query.get('limit') ?? PAGE_SIZE);
    const items = filtered.slice(from, from + size);
    const next = from + size < filtered.length ? String(from + size) : null;
    return HttpResponse.json<AdminChallengePage>({ items, next_cursor: next });
  }),
  http.get('*/api/v1/admin/challenges/:challengeId', ({ params }) => {
    const summary = mockAdminChallenges.find((challenge) => challenge.id === params.challengeId);
    if (!summary) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return HttpResponse.json<AdminChallengeDetail>(mockAdminChallengeDetail(summary));
  }),
  // Excluding judges the challenge again: its whole rankings, then without
  // the participant. The mocks write nothing, preview or not.
  http.delete(
    '*/api/v1/admin/challenges/:challengeId/participants/:userId',
    async ({ params, request }) => {
      const summary = mockAdminChallenges.find((challenge) => challenge.id === params.challengeId);
      if (!summary) {
        const body: ApiErrorBody = {
          error: { code: 'challenge_not_found', message: 'Challenge not found' },
        };
        return HttpResponse.json(body, { status: 404 });
      }
      const { dry_run } = (await request.json()) as { dry_run?: boolean };
      const { reference_sport, categories } = mockCategories(summary.id);
      const types = new Set(categories.map((category) => category.type));
      const before = mockLeaderboard.categories.filter((category) => types.has(category.type));
      const whole = (rankings: readonly FullRanking[]) =>
        answerLeaderboard(mockLeaderboard.computedAt, rankings, new URLSearchParams(), mockMe.id);
      return HttpResponse.json<AdminCorrection>({
        dry_run: dry_run === true,
        challenges: [
          {
            challenge_id: summary.id,
            title: summary.title,
            status: summary.status,
            reference_sport: { before: reference_sport, after: reference_sport },
            results: null,
            weeks: [],
            points: [],
            before: whole(before),
            after: whole(before.map((ranking) => withoutUser(ranking, String(params.userId)))),
            eliminations: [],
          },
        ],
      });
    },
  ),
  // Newest first in the API; the mocks keep their order. `q` is looked for
  // in the pseudo, the names and the e-mail.
  http.post('*/api/v1/admin/users/search', async ({ request }) => {
    const text = await request.text();
    const search = (text ? JSON.parse(text) : {}) as AdminUserSearch;
    const q = search.q?.toLocaleLowerCase();
    const found = mockAdminUsers.filter(
      (user) =>
        !q ||
        [user.pseudo, user.first_name, user.last_name, user.email].some((field) =>
          field?.toLocaleLowerCase().includes(q),
        ),
    );
    return HttpResponse.json<AdminUserPage>(mockPage(found, search.cursor, search.limit ?? null));
  }),
  http.get('*/api/v1/admin/users/:userId', ({ params }) => {
    const user = mockAdminUsers.find((account) => account.id === params.userId);
    return user ? HttpResponse.json<AdminUser>(user) : userNotFound();
  }),
  // The first account is in every challenge: creator of one in three,
  // abandoned one in four; the others in none.
  http.get('*/api/v1/admin/users/:userId/challenges', ({ params, request }) => {
    const index = mockAdminUsers.findIndex((account) => account.id === params.userId);
    if (index < 0) return userNotFound();
    const query = new URL(request.url).searchParams;
    const challenges = index === 0 ? mockAdminChallenges : [];
    const items = challenges.map((challenge, position) => {
      const is_creator = position % 3 === 0;
      const abandoned = position % 4 === 1;
      const participant = !is_creator || position % 2 === 0;
      return {
        id: challenge.id,
        title: challenge.title,
        visibility: challenge.visibility,
        timezone: challenge.timezone,
        status: challenge.status,
        starts_at: challenge.starts_at,
        ends_at: challenge.ends_at,
        created_at: challenge.created_at,
        deleted_at: challenge.deleted_at,
        is_creator,
        participant_status: participant ? (abandoned ? 'abandoned' : 'active') : null,
        joined_at: participant ? '2026-10-22T14:00:00Z' : null,
        abandoned_at: participant && abandoned ? '2026-11-10T14:00:00Z' : null,
      } satisfies AdminUserChallengePage['items'][number];
    });
    return HttpResponse.json<AdminUserChallengePage>(
      mockPage(items, query.get('cursor'), Number(query.get('limit')) || null),
    );
  }),
  // The first account has the activities of the mocks; the others none.
  http.get('*/api/v1/admin/users/:userId/activities', ({ params, request }) => {
    const index = mockAdminUsers.findIndex((account) => account.id === params.userId);
    if (index < 0) return userNotFound();
    const query = new URL(request.url).searchParams;
    const activities = index === 0 ? mockActivities : [];
    const items = activities.map((activity) => ({
      id: activity.id,
      sport_code: activity.sport_code,
      sport_label: activity.sport_label,
      started_at: activity.started_at,
      duration_seconds: activity.duration_seconds,
      distance_meters: activity.distance_meters,
      elevation_gain_meters: activity.elevation_gain_meters,
      source: activity.source,
      speed_mps: activity.speed_mps,
      pace_seconds_per_km: activity.pace_seconds_per_km,
      created_at: activity.started_at,
      contributions: activity.contributions,
      locked: activity.locked,
      admin_change: null,
    }));
    return HttpResponse.json<AdminActivityPage>(
      mockPage(items, query.get('cursor'), Number(query.get('limit')) || null),
    );
  }),
  // Most recent first, as the mocks are; the filters add up.
  http.get('*/api/v1/admin/actions', ({ request }) => {
    const query = new URL(request.url).searchParams;
    const type = query.get('target_type');
    const target = query.get('target_id');
    const challenge = query.get('challenge_id');
    const found = mockAdminActions.filter(
      (action) =>
        (!type || action.target_type === type) &&
        (!target || action.target_id === target) &&
        (!challenge || action.challenge_ids.includes(challenge)),
    );
    return HttpResponse.json<AdminActionPage>(
      mockPage(found, query.get('cursor'), Number(query.get('limit')) || null),
    );
  }),
  // The cursor is the index of the next item; `mine` keeps the challenges
  // the user created or joined, and `status` keeps those with that status.
  http.get('*/api/v1/challenges', ({ request }) => {
    const query = new URL(request.url).searchParams;
    const all =
      query.get('scope') === 'mine'
        ? mockChallenges.filter((challenge) => challenge.my_status !== null)
        : mockChallenges.filter((challenge) => challenge.visibility === 'public');
    const status = query.get('status');
    const filtered = status ? all.filter((challenge) => challenge.status === status) : all;
    const from = Number(query.get('cursor') ?? 0);
    const size = Number(query.get('limit') ?? PAGE_SIZE);
    const items = filtered.slice(from, from + size);
    const next = from + size < filtered.length ? String(from + size) : null;
    const counts = { upcoming: 0, ongoing: 0, finished: 0 };
    for (const challenge of all) counts[challenge.status] += 1;
    return HttpResponse.json<ChallengePage>({ items, next_cursor: next, counts });
  }),
  // An unknown id answers like a deleted or hidden challenge.
  http.get('*/api/v1/challenges/:challengeId', ({ params }) => {
    const summary = mockChallenges.find((challenge) => challenge.id === params.challengeId);
    if (!summary) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return HttpResponse.json<ChallengeDetail>(mockChallengeDetail(summary));
  }),
  // The cursor is the index of the next participant.
  http.get('*/api/v1/challenges/:challengeId/participants', ({ params, request }) => {
    if (!mockChallenges.some((challenge) => challenge.id === params.challengeId)) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    const query = new URL(request.url).searchParams;
    const from = Number(query.get('cursor') ?? 0);
    const size = Number(query.get('limit') ?? PAGE_SIZE);
    const items = mockParticipants.slice(from, from + size);
    const next = from + size < mockParticipants.length ? String(from + size) : null;
    return HttpResponse.json<ParticipantPage>({ items, next_cursor: next });
  }),
  // Paginated after the podium with `limit` (the cursor is the index of the next line).
  http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ params, request }) => {
    if (!mockChallenges.some((challenge) => challenge.id === params.challengeId)) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    // Only the categories the challenge has.
    const types = new Set(mockCategories(String(params.challengeId)).categories.map((c) => c.type));
    return HttpResponse.json<Leaderboard>(
      answerLeaderboard(
        mockLeaderboard.computedAt,
        mockLeaderboard.categories.filter((category) => types.has(category.type)),
        new URL(request.url).searchParams,
        mockMe.id,
      ),
    );
  }),
  // Every participant shows the user's activities; the cursor is the index
  // of the next one. Someone who never joined answers 404.
  http.get(
    '*/api/v1/challenges/:challengeId/participants/:userId/activities',
    ({ params, request }) => {
      if (!mockChallenges.some((challenge) => challenge.id === params.challengeId)) {
        const body: ApiErrorBody = {
          error: { code: 'challenge_not_found', message: 'Challenge not found' },
        };
        return HttpResponse.json(body, { status: 404 });
      }
      if (!mockParticipants.some((participant) => participant.user_id === params.userId)) {
        const body: ApiErrorBody = { error: { code: 'not_found', message: 'Not found' } };
        return HttpResponse.json(body, { status: 404 });
      }
      const query = new URL(request.url).searchParams;
      const from = Number(query.get('cursor') ?? 0);
      const size = Number(query.get('limit') ?? PAGE_SIZE);
      const items = mockActivities.slice(from, from + size);
      const next = from + size < mockActivities.length ? String(from + size) : null;
      return HttpResponse.json<ActivityPage>({ items, next_cursor: next });
    },
  ),
  // Every challenge shows the mock activities, each from a participant in
  // turn; the cursor is the index of the next one.
  http.get('*/api/v1/challenges/:challengeId/activities', ({ params, request }) => {
    if (!mockChallenges.some((challenge) => challenge.id === params.challengeId)) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    const query = new URL(request.url).searchParams;
    const from = Number(query.get('cursor') ?? 0);
    const size = Number(query.get('limit') ?? PAGE_SIZE);
    const items = mockActivities.slice(from, from + size).map((activity, index) => {
      const author = mockParticipants[(from + index) % mockParticipants.length];
      if (!author) throw new Error('No mock participant');
      const { user_id: id, pseudo, first_name, last_name } = author;
      return { ...activity, user: { id, pseudo, first_name, last_name, avatar: null } };
    });
    const next = from + size < mockActivities.length ? String(from + size) : null;
    return HttpResponse.json<ChallengeActivityPage>({ items, next_cursor: next });
  }),
  // The challenge with its new title and description; an empty description
  // removes it.
  http.patch('*/api/v1/challenges/:challengeId', async ({ params, request }) => {
    const summary = mockChallenges.find((challenge) => challenge.id === params.challengeId);
    if (!summary) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    const update = (await request.json()) as ChallengeUpdate;
    const detail = mockChallengeDetail(summary);
    return HttpResponse.json<ChallengeDetail>({
      ...detail,
      title: update.title?.trim() ?? detail.title,
      description:
        update.description === undefined ? detail.description : update.description || null,
    });
  }),
  // The challenge as the new participant sees it.
  http.post('*/api/v1/challenges/:challengeId/join', ({ params }) => {
    const summary = mockChallenges.find((challenge) => challenge.id === params.challengeId);
    if (!summary) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return HttpResponse.json<ChallengeDetail>(
      {
        ...mockChallengeDetail(summary),
        my_role: 'participant',
        my_status: 'active',
        can_join: false,
      },
      { status: 201 },
    );
  }),
  // The challenge as the user sees it once abandoned: a creator keeps the role.
  http.post('*/api/v1/challenges/:challengeId/abandon', ({ params }) => {
    const summary = mockChallenges.find((challenge) => challenge.id === params.challengeId);
    if (!summary) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return HttpResponse.json<ChallengeDetail>({
      ...mockChallengeDetail(summary),
      my_role: summary.my_role === 'creator' ? 'creator' : 'abandoned',
      my_status: 'abandoned',
      can_join: false,
    });
  }),
  // Deleted at once; an unknown id answers like a challenge already deleted.
  http.delete('*/api/v1/challenges/:challengeId', ({ params }) => {
    if (!mockChallenges.some((challenge) => challenge.id === params.challengeId)) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),
  // The challenge as the creator who added another one sees it.
  http.post('*/api/v1/challenges/:challengeId/creators', ({ params }) => {
    const summary = mockChallenges.find((challenge) => challenge.id === params.challengeId);
    if (!summary) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return HttpResponse.json<ChallengeDetail>(mockChallengeDetail(summary));
  }),
  // Excluded (or already out).
  http.delete('*/api/v1/challenges/:challengeId/participants/:userId', ({ params }) => {
    if (!mockChallenges.some((challenge) => challenge.id === params.challengeId)) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),
  // A link valid until the end of week 1 of the challenge.
  http.post('*/api/v1/challenges/:challengeId/invitations', ({ params }) => {
    const summary = mockChallenges.find((challenge) => challenge.id === params.challengeId);
    if (!summary) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return HttpResponse.json<InvitationCreated>(
      {
        token: mockInvitationToken,
        expires_at: mockChallengeDetail(summary).registration_deadline,
      },
      { status: 201 },
    );
  }),
  // The link the mocks create leads to a private challenge open to joining;
  // any other token is an invalid invitation.
  http.post('*/api/v1/invitations/open', async ({ request }) => {
    const { token } = (await request.json()) as InvitationTokenRequest;
    const summary = mockChallenges.find((challenge) => challenge.id === mockInvitedChallengeId);
    if (token !== mockInvitationToken || !summary) return invitationInvalid();
    return HttpResponse.json<InvitationPreview>({
      challenge_id: summary.id,
      title: summary.title,
      starts_at: summary.starts_at,
      ends_at: summary.ends_at,
    });
  }),
  // The challenge as the new participant sees it.
  http.post('*/api/v1/invitations/accept', async ({ request }) => {
    const { token } = (await request.json()) as InvitationTokenRequest;
    const summary = mockChallenges.find((challenge) => challenge.id === mockInvitedChallengeId);
    if (token !== mockInvitationToken || !summary) return invitationInvalid();
    return HttpResponse.json<ChallengeDetail>(
      {
        ...mockChallengeDetail(summary),
        my_role: 'participant',
        my_status: 'active',
        can_join: false,
      },
      { status: 201 },
    );
  }),
  // Any API address: the tests and the development server use different ones.
  http.get('*/api/v1/sports', () =>
    HttpResponse.json<SportList>({
      sports: withoutExercises([
        {
          code: 'climbing',
          distance_mode: 'none',
          suggested_factor: null,
          elevation_allowed: false,
        },
        {
          code: 'crossfit',
          distance_mode: 'none',
          suggested_factor: null,
          elevation_allowed: false,
        },
        { code: 'hike', distance_mode: 'required', suggested_factor: 1, elevation_allowed: true },
        { code: 'hyrox', distance_mode: 'required', suggested_factor: 1, elevation_allowed: false },
        { code: 'other', distance_mode: 'optional', suggested_factor: 1, elevation_allowed: true },
        {
          code: 'paragliding',
          distance_mode: 'required',
          suggested_factor: 0.3,
          elevation_allowed: false,
        },
        { code: 'ride', distance_mode: 'required', suggested_factor: 0.3, elevation_allowed: true },
        {
          code: 'roller',
          distance_mode: 'required',
          suggested_factor: 0.5,
          elevation_allowed: true,
        },
        {
          code: 'rowing',
          distance_mode: 'required',
          suggested_factor: 0.5,
          elevation_allowed: false,
        },
        { code: 'run', distance_mode: 'required', suggested_factor: 1, elevation_allowed: true },
        {
          code: 'strength',
          distance_mode: 'none',
          suggested_factor: null,
          elevation_allowed: false,
        },
        { code: 'swim', distance_mode: 'required', suggested_factor: 1, elevation_allowed: false },
        { code: 'walk', distance_mode: 'required', suggested_factor: 1, elevation_allowed: true },
        {
          code: 'xc_ski',
          distance_mode: 'required',
          suggested_factor: 0.5,
          elevation_allowed: true,
        },
        { code: 'yoga', distance_mode: 'none', suggested_factor: null, elevation_allowed: false },
      ]),
    }),
  ),
  // The recorded activity as the server answers it, from the request: it
  // counts in no challenge, and the speed is computed.
  http.post('*/api/v1/activities', async ({ request }) => {
    const body = (await request.json()) as ActivityCreate;
    const distance = body.distance_meters ?? null;
    return HttpResponse.json<Activity>(
      {
        id: '00000000-0000-4000-8000-0000000000a1',
        sport_code: body.sport_code,
        sport_label: body.sport_label ?? null,
        started_at: body.started_at,
        duration_seconds: body.duration_seconds,
        distance_meters: distance,
        elevation_gain_meters: body.elevation_gain_meters ?? null,
        source: 'manual',
        speed_mps: distance === null ? null : distance / body.duration_seconds,
        pace_seconds_per_km: distance === null ? null : body.duration_seconds / (distance / 1000),
        contributions: [],
        locked: false,
      },
      { status: 201 },
    );
  }),
  // The cursor is the index of the next activity.
  http.get('*/api/v1/me/activities', ({ request }) => {
    const query = new URL(request.url).searchParams;
    const from = Number(query.get('cursor') ?? 0);
    const kept = ofSport(query.get('sport'));
    const size = Number(query.get('limit') ?? PAGE_SIZE);
    const items = kept.slice(from, from + size);
    const next = from + size < kept.length ? String(from + size) : null;
    return HttpResponse.json<ActivityPage>({ items, next_cursor: next });
  }),
  // The current week of the real clock (the mock activities may be older).
  http.get('*/api/v1/me/activities/summary', ({ request }) => {
    const timeZone = new URL(request.url).searchParams.get('tz') ?? 'UTC';
    const monday = mondayOf(localDate(new Date(), timeZone));
    const week = weekTotals(monday, timeZone, mockActivities);
    const counts = new Map<string, number>();
    for (const { sport_code } of mockActivities) {
      counts.set(sport_code, (counts.get(sport_code) ?? 0) + 1);
    }
    return HttpResponse.json<components['schemas']['ActivitySummary']>({
      current_week: {
        ...week,
        days: Array.from({ length: 7 }, (_, index) => {
          const date = addToDate(monday, { days: index });
          const day = mockActivities.filter(
            (activity) => localDate(new Date(activity.started_at), timeZone) === date,
          );
          return {
            date,
            sessions: day.length,
            duration_seconds: day.reduce((sum, activity) => sum + activity.duration_seconds, 0),
          };
        }),
      },
      sports: [...counts]
        .map(([sport_code, count]) => ({ sport_code, count }))
        .sort((a, b) => b.count - a.count || a.sport_code.localeCompare(b.sport_code)),
      total: mockActivities.length,
      total_duration_seconds: mockActivities.reduce(
        (sum, activity) => sum + activity.duration_seconds,
        0,
      ),
      challenge_count: 3,
    });
  }),
  // Every week on one page.
  http.get('*/api/v1/me/activities/weeks', ({ request }) => {
    const query = new URL(request.url).searchParams;
    const timeZone = query.get('tz') ?? 'UTC';
    const kept = ofSport(query.get('sport'));
    const mondays = [
      ...new Set(
        kept.map((activity) => mondayOf(localDate(new Date(activity.started_at), timeZone))),
      ),
    ];
    return HttpResponse.json<components['schemas']['ActivityWeekPage']>({
      items: mondays.map((monday) => weekTotals(monday, timeZone, kept)),
      next_cursor: null,
    });
  }),
  // The activity as replaced, from the request; the list stays as it was.
  http.patch('*/api/v1/activities/:activityId', async ({ params, request }) => {
    const activity = mockActivities.find((candidate) => candidate.id === params.activityId);
    if (!activity) return activityNotFound();
    const body = (await request.json()) as ActivityCreate;
    const distance = body.distance_meters ?? null;
    return HttpResponse.json<Activity>({
      ...activity,
      sport_code: body.sport_code,
      sport_label: body.sport_label ?? null,
      started_at: body.started_at,
      duration_seconds: body.duration_seconds,
      distance_meters: distance,
      speed_mps: distance === null ? null : distance / body.duration_seconds,
      pace_seconds_per_km: distance === null ? null : body.duration_seconds / (distance / 1000),
    });
  }),
  http.delete('*/api/v1/activities/:activityId', ({ params }) =>
    mockActivities.some((activity) => activity.id === params.activityId)
      ? new HttpResponse(null, { status: 204 })
      : activityNotFound(),
  ),
  // The created challenge as the server answers it, from the request.
  http.post('*/api/v1/challenges', async ({ request }) => {
    const body = (await request.json()) as ChallengeCreate;
    const { startsAt, endsAt } = challengeWindow(body.start_date, body.weeks, body.timezone);
    return HttpResponse.json<Challenge>(
      {
        id: '00000000-0000-4000-8000-000000000001',
        title: body.title.trim(),
        description: body.description ?? '',
        visibility: body.visibility,
        members_can_invite: body.members_can_invite ?? false,
        timezone: body.timezone,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reference_sport: body.reference_sport ?? 'run',
        categories: [
          { type: 'cumulative_time', position: 1, params: {} },
          ...(body.categories?.cumulative_distance
            ? [
                {
                  type: 'cumulative_distance' as const,
                  position: 2,
                  params: { factors: { ride: 0.3, ...body.distance_factors } },
                },
              ]
            : []),
          ...(body.categories?.elimination
            ? [
                {
                  type: 'elimination' as const,
                  position: 3,
                  params: {
                    sport: body.reference_sport ?? 'run',
                    step_meters: body.categories.elimination.step_meters,
                  },
                },
              ]
            : []),
        ],
      },
      { status: 201 },
    );
  }),
];
