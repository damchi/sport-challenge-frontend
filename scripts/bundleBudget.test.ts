import { describe, expect, it } from 'vitest';
import { initialAssets, overBudget, type Asset } from './bundleBudget.ts';

const html = `<!doctype html>
<html>
  <head>
    <link rel="manifest" href="/manifest.webmanifest" />
    <script type="module" crossorigin src="/assets/index-a.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/react-b.js">
    <link rel="stylesheet" crossorigin href="/assets/index-c.css">
  </head>
</html>`;

const budget = { initialScripts: 100_000, initialStyles: 10_000, lazyChunk: 50_000 };
const initial = new Set(['/assets/index-a.js', '/assets/react-b.js', '/assets/index-c.css']);

describe('initialAssets', () => {
  it('keeps the entry script, its preloads and its stylesheet', () => {
    expect(initialAssets(html)).toEqual(initial);
  });
});

describe('overBudget', () => {
  it('passes a build within its budget', () => {
    const assets: Asset[] = [
      { path: '/assets/index-a.js', gzipBytes: 60_000 },
      { path: '/assets/react-b.js', gzipBytes: 40_000 },
      { path: '/assets/index-c.css', gzipBytes: 10_000 },
      { path: '/assets/ProfilePage-d.js', gzipBytes: 50_000 },
      { path: '/assets/AdminPage-f.js', gzipBytes: 1_000 },
    ];
    expect(overBudget(assets, initial, budget)).toEqual([]);
  });

  it('adds up the initial scripts, and checks each lazy chunk alone', () => {
    const assets: Asset[] = [
      { path: '/assets/index-a.js', gzipBytes: 60_000 },
      { path: '/assets/react-b.js', gzipBytes: 41_000 },
      { path: '/assets/index-c.css', gzipBytes: 11_000 },
      { path: '/assets/ProfilePage-d.js', gzipBytes: 51_000 },
      { path: '/assets/Other-e.css', gzipBytes: 500_000 },
      { path: '/assets/AdminPage-f.js', gzipBytes: 1_000 },
    ];
    expect(overBudget(assets, initial, budget)).toEqual([
      'initial scripts: 101.0 kB > 100.0 kB',
      'initial styles: 11.0 kB > 10.0 kB',
      '/assets/ProfilePage-d.js: 51.0 kB > 50.0 kB',
    ]);
  });

  describe('the admin section', () => {
    const app: Asset[] = [
      { path: '/assets/index-a.js', gzipBytes: 60_000 },
      { path: '/assets/react-b.js', gzipBytes: 40_000 },
      { path: '/assets/index-c.css', gzipBytes: 10_000 },
    ];
    const ownChunk = 'admin pages: not in a lazy chunk of their own';

    it('fails when its code has no chunk of its own', () => {
      expect(overBudget(app, initial, budget)).toEqual([ownChunk]);
    });

    it('fails when the app loads its chunk from the start', () => {
      const assets = [...app, { path: '/assets/AdminPage-f.js', gzipBytes: 1_000 }];
      const loaded = new Set([...initial, '/assets/AdminPage-f.js']);
      expect(overBudget(assets, loaded, { ...budget, initialScripts: 200_000 })).toEqual([
        ownChunk,
      ]);
    });
  });

  it('fails when index.html loads no script', () => {
    expect(overBudget([], new Set(), budget)).toEqual(['index.html loads no script']);
  });
});
