import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createFakeAuth } from '../../test/fakeAuth';
import { FakeAuthProvider } from '../../test/FakeAuthProvider';
import { createTestQueryClient } from '../../test/render';
import { useSignOut } from './useSignOut';

describe('useSignOut', () => {
  it('drops the cached data before signing out', async () => {
    const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['challenges', 'c1'], { name: 'private' });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <FakeAuthProvider auth={auth}>{children}</FakeAuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useSignOut(), { wrapper });

    await result.current();

    expect(queryClient.getQueryData(['challenges', 'c1'])).toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
