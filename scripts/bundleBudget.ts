// Size budget of the production build, in gzip bytes (what a phone downloads).
// The initial load is what index.html fetches before the first page shows:
// its entry script, the chunks it preloads and its stylesheet. Every other
// chunk loads with the page that needs it.

export const BUDGET = {
  initialScripts: 240_000,
  initialStyles: 10_000,
  lazyChunk: 50_000,
};

export interface Asset {
  /** Path from the root of the build, as index.html names it (/assets/x.js). */
  path: string;
  gzipBytes: number;
}

/** Scripts and stylesheets index.html loads: its script, preloads and links. */
export function initialAssets(html: string): Set<string> {
  const tags = html.match(/<(?:script|link)\b[^>]*>/g) ?? [];
  const paths = tags.flatMap((tag) => {
    const path = /\b(?:src|href)="([^"]+\.(?:js|css))"/.exec(tag)?.[1];
    return path ? [path] : [];
  });
  return new Set(paths);
}

const kB = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;

/** The overruns of the budget, one line each; empty when the build fits. */
export function overBudget(assets: Asset[], initial: Set<string>, budget = BUDGET): string[] {
  const total = (extension: string) =>
    assets
      .filter(({ path }) => initial.has(path) && path.endsWith(extension))
      .reduce((sum, { gzipBytes }) => sum + gzipBytes, 0);
  // Nothing measured is not a pass: the build or its index.html changed shape.
  if (![...initial].some((path) => path.endsWith('.js'))) return ['index.html loads no script'];
  const report: string[] = [];
  const scripts = total('.js');
  if (scripts > budget.initialScripts) {
    report.push(`initial scripts: ${kB(scripts)} > ${kB(budget.initialScripts)}`);
  }
  const styles = total('.css');
  if (styles > budget.initialStyles) {
    report.push(`initial styles: ${kB(styles)} > ${kB(budget.initialStyles)}`);
  }
  for (const { path, gzipBytes } of assets) {
    if (!initial.has(path) && path.endsWith('.js') && gzipBytes > budget.lazyChunk) {
      report.push(`${path}: ${kB(gzipBytes)} > ${kB(budget.lazyChunk)}`);
    }
  }
  return report;
}

/** The sizes the build has, for the log. */
export function summary(assets: Asset[], initial: Set<string>): string {
  const scripts = assets.filter(({ path }) => initial.has(path) && path.endsWith('.js'));
  const lazy = assets.filter(({ path }) => !initial.has(path) && path.endsWith('.js'));
  const largest = lazy.reduce<Asset | undefined>(
    (max, asset) => (!max || asset.gzipBytes > max.gzipBytes ? asset : max),
    undefined,
  );
  const sum = scripts.reduce((total, { gzipBytes }) => total + gzipBytes, 0);
  return [
    `initial scripts: ${kB(sum)} (${scripts.length} files, budget ${kB(BUDGET.initialScripts)})`,
    largest &&
      `largest lazy chunk: ${largest.path} ${kB(largest.gzipBytes)} (budget ${kB(BUDGET.lazyChunk)})`,
  ]
    .filter(Boolean)
    .join('\n');
}
