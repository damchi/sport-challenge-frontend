import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { mockInvitationToken } from '../src/mocks/handlers';
import { expect, signInAt, test } from './fixtures';

// An ongoing challenge the user takes part in (week 3 of 4 in the mocks).
const CHALLENGE_ID = '00000000-0000-4000-8000-000000000005';

// The key screens, each audited once its first heading shows (data loaded).
const SCREENS = [
  { name: 'challenges', path: '/' },
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

test('the abandon dialog has no serious accessibility violation', async ({ page }) => {
  await signInAt(page, `/challenges/${CHALLENGE_ID}`);
  await page.getByRole('button', { name: 'Abandonner le défi' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  expect(await seriousViolations(page)).toEqual([]);
});

// Text enlarged to 200 % (the browser's text size setting): every screen still fits
// the width, nothing pushed off the side. (the browser's text size): every screen still fits
// the width, nothing pushed off the side.
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
  });
}
