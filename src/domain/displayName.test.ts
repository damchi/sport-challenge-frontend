import { displayName } from './displayName';

describe('displayName', () => {
  it('shows the pseudo when there is one', () => {
    expect(displayName({ pseudo: 'marie_92', first_name: 'Marie', last_name: 'Tremblay' })).toBe(
      'marie_92',
    );
  });

  it('else shows the first and last name', () => {
    expect(displayName({ pseudo: null, first_name: 'Marie', last_name: 'Tremblay' })).toBe(
      'Marie Tremblay',
    );
    expect(displayName({ pseudo: '', first_name: 'Marie', last_name: null })).toBe('Marie');
  });

  it('gives null without any name', () => {
    expect(displayName({ pseudo: null, first_name: null, last_name: '' })).toBeNull();
  });
});
