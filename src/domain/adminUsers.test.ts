import { MAX_USER_SEARCH_LENGTH, readUserSearch, userChallengeRole } from './adminUsers';

describe('readUserSearch', () => {
  it('reads the search of the history state, trimmed', () => {
    expect(readUserSearch({ q: '  marie@example.com ' })).toBe('marie@example.com');
  });

  it('cuts it to what the API takes', () => {
    expect(readUserSearch({ q: 'a'.repeat(300) })).toHaveLength(MAX_USER_SEARCH_LENGTH);
  });

  it('leaves out an empty search and any other state', () => {
    expect(readUserSearch({ q: '   ' })).toBeUndefined();
    expect(readUserSearch({ q: 3 })).toBeUndefined();
    expect(readUserSearch(null)).toBeUndefined();
    expect(readUserSearch('marie')).toBeUndefined();
  });
});

describe('userChallengeRole', () => {
  it('names the role of the account in the challenge', () => {
    expect(userChallengeRole({ is_creator: true, participant_status: 'active' })).toBe('creator');
    expect(userChallengeRole({ is_creator: true, participant_status: null })).toBe('creator');
    expect(userChallengeRole({ is_creator: false, participant_status: 'active' })).toBe(
      'participant',
    );
    expect(userChallengeRole({ is_creator: false, participant_status: 'abandoned' })).toBe(
      'abandoned',
    );
    expect(userChallengeRole({ is_creator: true, participant_status: 'abandoned' })).toBe(
      'creatorAbandoned',
    );
  });
});
