import { startServiceWorker } from './serviceWorker';

function fakeContainer() {
  const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration));
  return { register, container: { register } as unknown as ServiceWorkerContainer };
}

describe('startServiceWorker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the worker once the page has loaded', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const { register, container } = fakeContainer();

    startServiceWorker(container);
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('registers it at once when the page has already loaded', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    const { register, container } = fakeContainer();

    startServiceWorker(container);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('does nothing in a browser without service workers', () => {
    expect(() => startServiceWorker(undefined)).not.toThrow();
  });
});
