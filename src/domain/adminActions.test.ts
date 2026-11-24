import {
  adminTargetPath,
  changedFields,
  journalValue,
  readAdminActionFilters,
} from './adminActions';

const ID = '10000000-0000-4000-8000-000000000001';

describe('readAdminActionFilters', () => {
  it('keeps the filters the API takes', () => {
    expect(
      readAdminActionFilters(
        new URLSearchParams({ target_type: 'activity', target_id: ID, challenge_id: ID }),
      ),
    ).toEqual({ target_type: 'activity', target_id: ID, challenge_id: ID });
  });

  it('leaves out an unknown kind and an id that is no uuid', () => {
    expect(
      readAdminActionFilters(
        new URLSearchParams({ target_type: 'invitation', target_id: '42', challenge_id: 'x' }),
      ),
    ).toEqual({});
  });
});

describe('adminTargetPath', () => {
  it('opens the sheet of a challenge or an account, a participant being its account', () => {
    expect(adminTargetPath('challenge', ID)).toBe(`/admin/challenges/${ID}`);
    expect(adminTargetPath('user', ID)).toBe(`/admin/users/${ID}`);
    expect(adminTargetPath('participant', ID)).toBe(`/admin/users/${ID}`);
  });

  it('has none for an activity', () => {
    expect(adminTargetPath('activity', ID)).toBeUndefined();
  });
});

describe('changedFields', () => {
  it('pairs the old and new value of each field, the old ones first', () => {
    expect(changedFields({ title: 'A', deadline: null }, { title: 'B', ends: 3 })).toEqual([
      { field: 'title', before: 'A', after: 'B' },
      { field: 'deadline', before: null },
      { field: 'ends', after: 3 },
    ]);
  });

  it('has only new values for a creation, only old ones for a removal', () => {
    expect(changedFields(null, { status: 'active' })).toEqual([
      { field: 'status', after: 'active' },
    ]);
    expect(changedFields({ status: 'active' }, null)).toEqual([
      { field: 'status', before: 'active' },
    ]);
    expect(changedFields(null, null)).toEqual([]);
  });
});

describe('journalValue', () => {
  it('writes a string as is and anything else in JSON', () => {
    expect(journalValue('Après')).toBe('Après');
    expect(journalValue(null)).toBe('null');
    expect(journalValue(3600)).toBe('3600');
    expect(journalValue({ run: 1 })).toBe('{"run":1}');
  });
});
