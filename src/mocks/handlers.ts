import { http, HttpResponse } from 'msw';
import type { components } from '../api/generated/schema';

// Mock handlers shared by the tests (src/mocks/server.ts) and the development
// mocks (VITE_MOCKS=true). Each ticket adds the routes it uses, typed by the
// contract. A handler that needs the date reads `new Date()`: its tests fix it
// with vi.setSystemTime, never the real clock (the first such handler adds
// that test).

type SportList = components['schemas']['SportList'];
type Me = components['schemas']['Me'];
type ChallengeSummary = components['schemas']['ChallengeSummary'];
type ChallengePage = components['schemas']['ChallengePage'];

/** Profile of the mocks: complete, as for most screens; onboarding tests override it. */
export const mockMe: Me = {
  id: '6f1c2a8e-3b5d-4e7f-9a0b-1c2d3e4f5a6b',
  pseudo: 'marie_92',
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
  // Any API address: the tests and the development server use different ones.
  http.get('*/api/v1/sports', () =>
    HttpResponse.json<SportList>({
      sports: [
        { code: 'run', distance_mode: 'required', suggested_factor: 1 },
        { code: 'ride', distance_mode: 'required', suggested_factor: 0.3 },
        { code: 'other', distance_mode: 'optional', suggested_factor: null },
      ],
    }),
  ),
];
