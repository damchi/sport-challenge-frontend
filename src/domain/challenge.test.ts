import { canSeeParticipantActivities, isChallengeId, isUserId } from './challenge';

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
