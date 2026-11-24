import { readAdminChallengeFilters } from './adminChallenges';

const read = (query: string) => readAdminChallengeFilters(new URLSearchParams(query));

describe('readAdminChallengeFilters', () => {
  it('reads every filter of the address', () => {
    expect(read('q=+Hiver+&status=ongoing&visibility=private&deleted=true')).toEqual({
      q: 'Hiver',
      status: 'ongoing',
      visibility: 'private',
      deleted: true,
    });
  });

  it('leaves out what the API would refuse', () => {
    expect(read('q=+++&status=soon&visibility=friends&deleted=yes')).toEqual({});
    expect(read('')).toEqual({});
  });

  it('cuts a search to the length the API takes', () => {
    expect(read(`q=${'a'.repeat(100)}`).q).toHaveLength(80);
  });
});
