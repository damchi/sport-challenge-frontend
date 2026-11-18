// Copies the backend OpenAPI contract into openapi/openapi.yaml and stops
// when the new contract breaks the current one (oasdiff, in Docker).
//
// Source, in order: the API_CONTRACT variable (a path or an https URL), the
// backend cloned next to this repository, then the backend's main branch.
//
// Usage: pnpm api:sync [--accept-breaking]
//   --accept-breaking  write a breaking contract after reviewing the report

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const TARGET = 'openapi/openapi.yaml';
const LOCAL_SOURCES = ['../backend/api/openapi.yaml', '../sport-challenge-api/api/openapi.yaml'];
const REMOTE_SOURCE =
  'https://raw.githubusercontent.com/damchi/sport-challenge-api/main/api/openapi.yaml';
const OASDIFF_IMAGE =
  'tufin/oasdiff:v1.39.0@sha256:004bef22058ace818b61f0eb2f05efb89fc6a3882f68bf4db0b6a86f40723fe0';

function chooseSource(): string {
  const fromEnv = process.env.API_CONTRACT;
  if (fromEnv) return fromEnv;
  return LOCAL_SOURCES.find((path) => existsSync(path)) ?? REMOTE_SOURCE;
}

async function readContract(source: string): Promise<string> {
  if (/^https?:/.test(source)) {
    if (!source.startsWith('https://')) throw new Error(`Refusing a non-https source: ${source}`);
    // No redirect: it could lead to a non-https address.
    const response = await fetch(source, {
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
    return response.text();
  }
  return readFileSync(source, 'utf8');
}

// The Docker daemon and the image are checked first: docker itself also exits
// with 1, which would otherwise read as breaking changes.
function prepareOasdiff(): void {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
  } catch (error) {
    throw new Error('Docker is not running: start it to compare the contracts.', { cause: error });
  }
  execFileSync('docker', ['pull', '--quiet', OASDIFF_IMAGE], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

// Exit code 1 of oasdiff means breaking changes; its report is printed as is.
function hasBreakingChanges(current: string, next: string): boolean {
  prepareOasdiff();
  const dir = mkdtempSync(join(tmpdir(), 'api-sync-'));
  try {
    writeFileSync(join(dir, 'current.yaml'), current);
    writeFileSync(join(dir, 'next.yaml'), next);
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${dir}:/specs:ro`,
        OASDIFF_IMAGE,
        'breaking',
        '/specs/current.yaml',
        '/specs/next.yaml',
        '--fail-on',
        'ERR',
      ],
      { stdio: 'inherit' },
    );
    return false;
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 1) return true;
    throw new Error('oasdiff could not run.', { cause: error });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const source = chooseSource();
const next = await readContract(source);
const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : undefined;

if (current === next) {
  console.log(`${TARGET} is up to date (${source}).`);
} else {
  if (current !== undefined && hasBreakingChanges(current, next)) {
    if (!process.argv.includes('--accept-breaking')) {
      console.error(
        `\nBreaking changes above: ${TARGET} is unchanged. Review them, then run pnpm api:sync --accept-breaking.`,
      );
      process.exit(1);
    }
    console.warn('\nBreaking changes accepted.');
  }
  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, next);
  console.log(`${TARGET} updated from ${source}. Run pnpm api:generate.`);
}
