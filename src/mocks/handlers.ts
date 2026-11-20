import { http, HttpResponse } from 'msw';
import type { components } from '../api/generated/schema';
import { challengeWindow } from '../domain/challengeWindow';

// Mock handlers shared by the tests (src/mocks/server.ts) and the development
// mocks (VITE_MOCKS=true). Each ticket adds the routes it uses, typed by the
// contract. A handler that needs the date reads `new Date()`: its tests fix it
// with vi.setSystemTime, never the real clock (the first such handler adds
// that test).

type SportList = components['schemas']['SportList'];
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
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    title: `Défi ${index + 1}`,
    visibility: index % 4 === 3 ? 'private' : 'public',
    timezone: 'America/Montreal',
    starts_at: '2026-11-02T05:00:00Z',
    ends_at: '2026-11-30T05:00:00Z',
    participant_count: (index % 7) + 1,
    my_role: role,
    my_status: role === 'abandoned' ? 'abandoned' : role === 'outsider' ? null : 'active',
    status: index % 3 === 0 ? 'upcoming' : index % 3 === 1 ? 'ongoing' : 'finished',
  };
});

const PAGE_SIZE = 20;

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
    categories: [
      { type: 'cumulative_time', position: 1, params: {} },
      {
        type: 'cumulative_distance',
        position: 2,
        params: { factors: { run: 1, ride: 0.3, rowing: 0.5, walk: 1 } },
      },
      { type: 'run_elimination', position: 3, params: { sport: 'run', step_meters: 2000 } },
    ],
    my_role: summary.my_role,
    my_status: summary.my_status,
    status: summary.status,
    can_join: summary.my_role === 'outsider' && summary.status === 'upcoming',
    registration_deadline: '2026-11-09T05:00:00Z',
    current_week: ongoing ? 3 : null,
    week_ends_at: ongoing ? '2026-11-23T05:00:00Z' : null,
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
  joined_at: new Date(Date.UTC(2026, 10, 2, 14 + index)).toISOString(),
}));

/**
 * The ranking of a category from values given in participant order: best
 * first, equal values sharing a rank (1, 1, 3), the participants who
 * abandoned last, without a rank nor a value.
 */
type CategoryRanking = Leaderboard['categories'][number];

function mockRanking(
  type: CategoryRanking['type'],
  value: (index: number) => number,
): CategoryRanking {
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
    // In run_elimination only; outside the weeks of the challenge here.
    elimination:
      type === 'run_elimination'
        ? {
            status: null,
            eliminated_week: null,
            minimum_meters: null,
            run_meters: 0,
            week_ends_at: null,
          }
        : null,
  }));
  for (const participant of mockParticipants.filter((p) => p.status === 'abandoned')) {
    entries.push({
      rank: null,
      user: user(participant),
      value: null,
      abandoned: true,
      elimination: null,
    });
  }
  return { type, entries };
}

/** The leaderboard of every mock challenge, with ties in each category. */
const mockLeaderboard: Leaderboard = {
  computed_at: '2026-11-18T15:00:00Z',
  categories: [
    // Seconds; the first two are tied.
    mockRanking('cumulative_time', (index) => (index < 2 ? 36_000 : 30_000 - index * 600)),
    // Meters; the second and third are tied.
    mockRanking('cumulative_distance', (index) => 52_300 - Math.max(index, 2) * 1_000),
    mockRanking('run_elimination', (index) => 30_000 - index * 750),
  ],
};

export const handlers = [
  http.get('*/api/v1/me', () => HttpResponse.json<Me>(mockMe)),
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
    const items = filtered.slice(from, from + PAGE_SIZE);
    const next = from + PAGE_SIZE < filtered.length ? String(from + PAGE_SIZE) : null;
    return HttpResponse.json<ChallengePage>({ items, next_cursor: next });
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
    const from = Number(new URL(request.url).searchParams.get('cursor') ?? 0);
    const items = mockParticipants.slice(from, from + PAGE_SIZE);
    const next = from + PAGE_SIZE < mockParticipants.length ? String(from + PAGE_SIZE) : null;
    return HttpResponse.json<ParticipantPage>({ items, next_cursor: next });
  }),
  http.get('*/api/v1/challenges/:challengeId/leaderboard', ({ params }) => {
    if (!mockChallenges.some((challenge) => challenge.id === params.challengeId)) {
      const body: ApiErrorBody = {
        error: { code: 'challenge_not_found', message: 'Challenge not found' },
      };
      return HttpResponse.json(body, { status: 404 });
    }
    return HttpResponse.json<Leaderboard>(mockLeaderboard);
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
  // Any API address: the tests and the development server use different ones.
  http.get('*/api/v1/sports', () =>
    HttpResponse.json<SportList>({
      sports: [
        { code: 'climbing', distance_mode: 'none', suggested_factor: null },
        { code: 'hike', distance_mode: 'required', suggested_factor: 1 },
        { code: 'other', distance_mode: 'optional', suggested_factor: 1 },
        { code: 'ride', distance_mode: 'required', suggested_factor: 0.3 },
        { code: 'roller', distance_mode: 'required', suggested_factor: 0.5 },
        { code: 'rowing', distance_mode: 'required', suggested_factor: 0.5 },
        { code: 'run', distance_mode: 'required', suggested_factor: 1 },
        { code: 'strength', distance_mode: 'none', suggested_factor: null },
        { code: 'swim', distance_mode: 'required', suggested_factor: 1 },
        { code: 'walk', distance_mode: 'required', suggested_factor: 1 },
        { code: 'xc_ski', distance_mode: 'required', suggested_factor: 0.5 },
        { code: 'yoga', distance_mode: 'none', suggested_factor: null },
      ],
    }),
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
        categories: [
          { type: 'cumulative_time', position: 1, params: {} },
          {
            type: 'cumulative_distance',
            position: 2,
            params: { factors: { ride: 0.3, ...body.distance_factors } },
          },
          {
            type: 'run_elimination',
            position: 3,
            params: { sport: 'run', step_meters: body.elimination_step_meters },
          },
        ],
      },
      { status: 201 },
    );
  }),
];
