import { inBackground } from './background';

describe('inBackground', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for the delay, then for the device to be idle', () => {
    let idle: (() => void) | undefined;
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      idle = callback;
      return 1;
    });
    const task = vi.fn();
    inBackground(task);

    vi.advanceTimersByTime(2999);
    expect(idle).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(task).not.toHaveBeenCalled();
    idle?.();
    expect(task).toHaveBeenCalledOnce();
  });

  it('runs after the delay alone without an idle callback (Safari)', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    Reflect.deleteProperty(window, 'requestIdleCallback');
    const task = vi.fn();
    inBackground(task);

    vi.advanceTimersByTime(3000);
    expect(task).toHaveBeenCalledOnce();
  });

  it('runs nothing once cancelled, before the delay or while waiting for idle', () => {
    const cancelIdle = vi.fn();
    vi.stubGlobal('requestIdleCallback', () => 7);
    vi.stubGlobal('cancelIdleCallback', cancelIdle);
    const early = vi.fn();
    inBackground(early)();
    vi.advanceTimersByTime(3000);
    expect(early).not.toHaveBeenCalled();

    const cancel = inBackground(vi.fn());
    vi.advanceTimersByTime(3000);
    cancel();
    expect(cancelIdle).toHaveBeenCalledWith(7);
  });
});
