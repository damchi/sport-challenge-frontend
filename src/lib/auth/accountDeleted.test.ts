import { createFakeAuth } from '../../test/fakeAuth';
import { accountDeletedHandler } from './accountDeleted';

describe('accountDeletedHandler', () => {
  it('drops the data, shows the account is gone and signs out locally', () => {
    const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
    const clearCache = vi.fn();
    const onSessionEnd = vi.fn();

    accountDeletedHandler(auth, { clearCache, onSessionEnd })();

    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(onSessionEnd).toHaveBeenCalledWith({
      reason: 'account_deleted_by_user',
      returnTo: '/challenges',
    });
    expect(auth.signOut).toHaveBeenCalledWith({ local: true });
  });
});
