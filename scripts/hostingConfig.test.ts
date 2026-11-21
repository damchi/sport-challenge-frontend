import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, hostingConfig, inlineScriptHashes } from './hostingConfig.ts';

const theme = "\n      document.documentElement.dataset.theme = 'light';\n    ";
const html = `<!doctype html>
<html>
  <head>
    <script>${theme}</script>
    <script type="module" crossorigin src="/assets/app-a.js"></script>
  </head>
</html>`;
const themeHash = `'sha256-${createHash('sha256').update(theme).digest('base64')}'`;

const env = {
  VITE_API_URL: 'https://api.example.com',
  VITE_AUTH0_DOMAIN: 'auth.example.com',
  VITE_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2',
};

function directive(csp: string, name: string): string | undefined {
  return csp.split('; ').find((entry) => entry.startsWith(`${name} `));
}

describe('inlineScriptHashes', () => {
  it('hashes the inline scripts only, as written', () => {
    expect(inlineScriptHashes(html)).toEqual([themeHash]);
  });
});

describe('contentSecurityPolicy', () => {
  const csp = contentSecurityPolicy(env, [themeHash]);

  it('runs only the site scripts and the hashed inline one', () => {
    expect(directive(csp, 'script-src')).toBe(`script-src 'self' ${themeHash}`);
  });

  it('connects only to the site, the API, Auth0 and the Sentry host', () => {
    expect(directive(csp, 'connect-src')).toBe(
      "connect-src 'self' https://api.example.com https://auth.example.com https://o1.ingest.sentry.io",
    );
    expect(directive(csp, 'frame-src')).toBe('frame-src https://auth.example.com');
  });

  it('leaves Sentry out without a DSN', () => {
    const withoutSentry = contentSecurityPolicy({ ...env, VITE_SENTRY_DSN: undefined }, []);

    expect(directive(withoutSentry, 'connect-src')).toBe(
      "connect-src 'self' https://api.example.com https://auth.example.com",
    );
  });

  it('forbids framing the app and allows its worker and manifest', () => {
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'worker-src')).toBe("worker-src 'self' blob:");
    expect(directive(csp, 'manifest-src')).toBe("manifest-src 'self'");
  });

  it('refuses an address that is not one', () => {
    expect(() => contentSecurityPolicy({ ...env, VITE_API_URL: 'api' }, [])).toThrow(
      'VITE_API_URL is not an address: api',
    );
  });
});

describe('hostingConfig', () => {
  const { hosting } = hostingConfig(env, html);
  const rewrite = new RegExp(hosting.rewrites[0].regex);

  it('serves index.html for the app addresses, never for a file', () => {
    expect(
      ['/', '/callback', '/challenges/42/participants', '/invite'].every((path) =>
        rewrite.test(path),
      ),
    ).toBe(true);
    expect(
      ['/assets/app-old.js', '/sw.js', '/manifest.webmanifest', '/icon-192.png'].some((path) =>
        rewrite.test(path),
      ),
    ).toBe(false);
  });

  it('never caches the pages or the service worker, and caches assets for good', () => {
    const cacheOf = (pattern: string) =>
      hosting.headers
        .find((rule) => ('source' in rule ? rule.source : rule.regex) === pattern)
        ?.headers.find(({ key }) => key === 'Cache-Control')?.value;

    expect(cacheOf('^[^.]*$')).toBe('no-cache');
    expect(cacheOf('/index.html')).toBe('no-cache');
    expect(cacheOf('/sw.js')).toBe('no-cache');
    expect(cacheOf('/assets/**')).toBe('public, max-age=31536000, immutable');
  });

  it('sends the security headers with every response', () => {
    const all = hosting.headers.find((rule) => 'source' in rule && rule.source === '**');

    expect(all?.headers.map(({ key }) => key)).toEqual([
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
    ]);
  });
});
