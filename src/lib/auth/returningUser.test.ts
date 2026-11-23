import { forgetReturningUser, isReturningUser, rememberReturningUser } from './returningUser';

describe('returning user', () => {
  afterEach(() => localStorage.clear());

  it('is not returning on a new device', () => {
    expect(isReturningUser()).toBe(false);
  });

  it('is returning once remembered, until forgotten', () => {
    rememberReturningUser();
    expect(isReturningUser()).toBe(true);

    forgetReturningUser();
    expect(isReturningUser()).toBe(false);
  });

  it('is not returning when the storage cannot be read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(isReturningUser()).toBe(false);
    getItem.mockRestore();
  });
});
