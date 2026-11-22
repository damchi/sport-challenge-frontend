import {
  canSeeParticipantActivities,
  challengeIdList,
  isChallengeId,
  isUserId,
  challengeActions,
  shownFactors,
} from './challenge';

describe('isChallengeId', () => {
  it('accepts a UUID', () => {
    expect(isChallengeId('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isChallengeId('6F1C2A8E-3B5D-4E7F-9A0B-1C2D3E4F5A6B')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isChallengeId(undefined)).toBe(false);
    expect(isChallengeId('')).toBe(false);
    expect(isChallengeId('new')).toBe(false);
    expect(isChallengeId('00000000-0000-4000-8000-00000000000')).toBe(false);
    expect(isChallengeId('00000000-0000-4000-8000-000000000001/../x')).toBe(false);
  });
});

describe('challengeIdList', () => {
  const first = '00000000-0000-4000-8000-000000000001';
  const second = '00000000-0000-4000-8000-000000000002';

  it('keeps each valid id once, in order', () => {
    expect(challengeIdList(`${first}, ${second},${first}`)).toEqual([first, second]);
  });

  it('drops what is not an id', () => {
    expect(challengeIdList(`..,${first},,/admin`)).toEqual([first]);
    expect(challengeIdList(undefined)).toEqual([]);
  });
});

describe('isUserId', () => {
  it('accepts a UUID and refuses anything else', () => {
    expect(isUserId('10000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUserId(undefined)).toBe(false);
    expect(isUserId('me')).toBe(false);
    expect(isUserId('10000000-0000-4000-8000-000000000001/../x')).toBe(false);
  });
});

describe('canSeeParticipantActivities', () => {
  it('lets the creators and the participants in, abandoned ones included', () => {
    expect(canSeeParticipantActivities('creator')).toBe(true);
    expect(canSeeParticipantActivities('participant')).toBe(true);
    expect(canSeeParticipantActivities('abandoned')).toBe(true);
  });

  it('keeps the others out', () => {
    expect(canSeeParticipantActivities('invited')).toBe(false);
    expect(canSeeParticipantActivities('outsider')).toBe(false);
  });
});

describe('challengeActions', () => {
  it.each([
    [{ my_role: 'creator', my_status: 'active', status: 'ongoing' }, ['edit', 'delete', 'abandon']],
    [{ my_role: 'creator', my_status: 'abandoned', status: 'ongoing' }, ['edit', 'delete']],
    [{ my_role: 'creator', my_status: null, status: 'upcoming' }, ['edit', 'delete']],
    [{ my_role: 'creator', my_status: 'active', status: 'finished' }, ['edit', 'delete']],
    [{ my_role: 'participant', my_status: 'active', status: 'upcoming' }, ['abandon']],
    [{ my_role: 'participant', my_status: 'active', status: 'finished' }, []],
    [{ my_role: 'abandoned', my_status: 'abandoned', status: 'ongoing' }, []],
    [{ my_role: 'outsider', my_status: null, status: 'ongoing' }, []],
  ] as const)('gives %o the actions %o', (challenge, actions) => {
    expect(challengeActions(challenge)).toEqual(actions);
  });
});

describe('shownFactors', () => {
  const distance = { type: 'cumulative_distance', params: { factors: { run: 1, ride: 0.3 } } };
  const points = (criteria: string[]) => ({
    type: 'points',
    params: { criteria, factors: { run: 1, walk: 0.5 } },
  });

  it('gives the factors of the total distance first', () => {
    expect(shownFactors([points(['longest_distance']), distance])).toEqual({ run: 1, ride: 0.3 });
  });

  it('gives those of the points when a criterion uses the distance', () => {
    expect(shownFactors([points(['longest_distance'])])).toEqual({ run: 1, walk: 0.5 });
  });

  it('gives none otherwise', () => {
    expect(shownFactors([points(['session_count'])])).toBeUndefined();
    expect(shownFactors([{ type: 'cumulative_time', params: {} }])).toBeUndefined();
  });
});
