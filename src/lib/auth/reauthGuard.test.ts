import { createReauthGuard, resetReauthGuard } from './reauthGuard';

describe('createReauthGuard', () => {
  afterEach(() => resetReauthGuard());

  it('allows a first automatic re-sign-in', () => {
    expect(createReauthGuard(() => 1_000_000).allowed()).toBe(true);
  });

  it('refuses another one within a minute, even after a reload', () => {
    createReauthGuard(() => 1_000_000).record();
    // A new guard reads what the previous page load stored.
    const afterReload = (now: number) => createReauthGuard(() => now);

    expect(afterReload(1_030_000).allowed()).toBe(false);
    expect(afterReload(1_061_000).allowed()).toBe(true);
  });

  it('forgets a re-sign-in that did not start', () => {
    const guard = createReauthGuard(() => 1_000_000);
    guard.record();
    guard.forget();

    expect(createReauthGuard(() => 1_010_000).allowed()).toBe(true);
  });

  it('allows again once the user asks to retry', () => {
    createReauthGuard(() => 1_000_000).record();
    resetReauthGuard();

    expect(createReauthGuard(() => 1_010_000).allowed()).toBe(true);
  });
});
