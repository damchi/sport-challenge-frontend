import AxeBuilder from '@axe-core/playwright';
import { http, HttpResponse } from 'msw';
import type { Page } from '@playwright/test';
import { mockInvitationToken } from '../src/mocks/handlers';
import { expect, signInAt, test } from './fixtures';

// An ongoing challenge the user takes part in (week 3 of 4 in the mocks).
const CHALLENGE_ID = '00000000-0000-4000-8000-000000000005';

// The key screens, each audited once its first heading shows (data loaded).
const SCREENS = [
  { name: 'challenges', path: '/challenges' },
  { name: 'leaderboard', path: `/challenges/${CHALLENGE_ID}` },
  { name: 'participants', path: `/challenges/${CHALLENGE_ID}/participants` },
  { name: 'challenge creation', path: '/challenges/new' },
  { name: 'activities', path: '/activities' },
  { name: 'activity entry', path: '/activities/new' },
  { name: 'profile', path: '/profile' },
  { name: 'invitation', path: `/invite#${mockInvitationToken}` },
];

/** The serious and critical WCAG 2.x A/AA violations of the page, by rule. */
async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    );
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const screen of SCREENS) {
      test(`${screen.name} has no serious accessibility violation`, async ({ page }) => {
        await signInAt(page, screen.path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        // The loading skeletons are gone: the screen shows its data.
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  });
}

test('the error state has no serious accessibility violation', async ({ network, page }) => {
  network.use(http.get('*/api/v1/challenges', () => new HttpResponse(null, { status: 500 })));
  await signInAt(page, '/challenges');
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();

  expect(await seriousViolations(page)).toEqual([]);
});

test('the empty state has no serious accessibility violation', async ({ network, page }) => {
  network.use(
    http.get('*/api/v1/me/activities', () => HttpResponse.json({ items: [], next_cursor: null })),
  );
  await signInAt(page, '/activities');
  await expect(page.getByText('Aucune activité pour le moment.', { exact: false })).toBeVisible();

  expect(await seriousViolations(page)).toEqual([]);
});

test('the menu of a challenge has no serious accessibility violation', async ({ page }) => {
  await signInAt(page, `/challenges/${CHALLENGE_ID}`);
  await page.getByRole('button', { name: "Plus d'actions" }).click();
  await expect(page.getByRole('button', { name: 'Abandonner le défi' })).toBeVisible();

  expect(await seriousViolations(page)).toEqual([]);
});

test('the abandon dialog has no serious accessibility violation', async ({ page }) => {
  await signInAt(page, `/challenges/${CHALLENGE_ID}`);
  await page.getByRole('button', { name: "Plus d'actions" }).click();
  await page.getByRole('button', { name: 'Abandonner le défi' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  expect(await seriousViolations(page)).toEqual([]);
});

// Text enlarged to 200 % (the browser's text size setting): every screen
// still fits the width, and each control stays whole within it.
for (const screen of SCREENS) {
  test(`${screen.name} keeps its content with text at 200 %`, async ({ page }) => {
    await signInAt(page, screen.path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await page.locator('html').evaluate((html) => {
      html.style.fontSize = '200%';
    });

    const width = await page.locator('html').evaluate((html) => ({
      content: html.scrollWidth,
      viewport: html.clientWidth,
    }));
    expect(width.content).toBeLessThanOrEqual(width.viewport);
    const cut = await page.locator('main').evaluate((main) =>
      Array.from(main.querySelectorAll('a, button, input, select, textarea, label'))
        // A row that scrolls sideways on purpose (the filters) keeps its controls in reach.
        .filter((control) => !control.parentElement?.closest('.overflow-x-auto'))
        .filter((control) => {
          const box = control.getBoundingClientRect();
          return (
            box.width > 0 && (box.left < 0 || box.right > document.documentElement.clientWidth)
          );
        })
        .map((control) => control.textContent?.trim() || control.id),
    );
    expect(cut).toEqual([]);
  });
}
