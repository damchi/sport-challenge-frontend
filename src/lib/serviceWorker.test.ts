import { reportError } from './errorTracking';
import { startServiceWorker } from './serviceWorker';

vi.mock('./errorTracking', () => ({ reportError: vi.fn() }));

function fakeContainer(controller: ServiceWorker | null = null) {
  const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration));
  const events = new EventTarget();
  const container = Object.assign(events, { register, controller });
  return { register, container: container as unknown as ServiceWorkerContainer };
}

function loaded(...urls: string[]) {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue(
    urls.map((name) => ({ name }) as PerformanceEntry),
  );
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

  it('reports a failed registration', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    const failure = new TypeError('bad script');
    const register = vi.fn(() => Promise.reject(failure));

    const { container } = fakeContainer();
    startServiceWorker(Object.assign(container, { register }));

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith(failure));
  });

  it('asks again, once the worker controls the page, the files of /assets/ loaded before', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    const origin = window.location.origin;
    loaded(
      `${origin}/assets/app-1.js`,
      `${origin}/assets/fr-2.js`,
      `${origin}/assets/fr-2.js`,
      `${origin}/favicon.svg`,
      'https://api.test/api/v1/me',
    );
    const fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response());
    const { container } = fakeContainer();

    startServiceWorker(container);
    expect(fetch).not.toHaveBeenCalled();
    container.dispatchEvent(new Event('controllerchange'));

    expect(fetch.mock.calls.map(([file]) => file)).toEqual(['/assets/app-1.js', '/assets/fr-2.js']);
  });

  it('asks nothing again when the worker already controls the page', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    loaded(`${window.location.origin}/assets/fr-2.js`);
    const fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response());
    const { container } = fakeContainer({} as ServiceWorker);

    startServiceWorker(container);
    container.dispatchEvent(new Event('controllerchange'));

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does nothing in a browser without service workers', () => {
    expect(() => startServiceWorker(undefined)).not.toThrow();
  });
});
