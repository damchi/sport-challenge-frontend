import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { AUTH0_DOMAIN, FAKE_SIGN_IN } from './fakeAuth0';

const TITLE = 'Défie tes amis, semaine après semaine.';

test('a visitor reads the landing page, then starts and lands on their challenges', async ({
  page,
}) => {
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) apiCalls.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(page).toHaveTitle('Sport Challenge · Des défis sportifs entre amis');
  // Static: no sign-in page, no API call.
  expect(new URL(page.url()).host).not.toBe(AUTH0_DOMAIN);
  expect(apiCalls).toEqual([]);

  await page.getByRole('button', { name: 'Commencer' }).first().click();
  await page.getByRole('link', { name: FAKE_SIGN_IN }).click();
  await page.waitForURL((url) => url.host !== AUTH0_DOMAIN && url.pathname !== '/callback');

  expect(new URL(page.url()).pathname).toBe('/challenges');
  await expect(page.getByRole('heading', { level: 1, name: 'Défis' })).toBeVisible();
});

test('a signed-in user still reads the landing page, and goes on to their challenges', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('link', { name: FAKE_SIGN_IN }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Défis' })).toBeVisible();

  // Opened within the app (a full load drops the session in memory here: no
  // silent sign-in in the tests).
  await page.evaluate(() => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await page.getByRole('link', { name: 'Mes défis' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Défis' })).toBeVisible();
  await expect(page).toHaveURL('/challenges');
});

test('a deep link still signs in first', async ({ page }) => {
  await page.goto('/activities');

  await expect(page.getByRole('link', { name: FAKE_SIGN_IN })).toBeVisible();
});

test('the landing page switches to English', async ({ page }) => {
  await page.goto('/');
  await page.getByText('EN', { exact: true }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Challenge your friends, week after week.' }),
  ).toBeVisible();
  await expect(page.getByText('×0.3')).toBeVisible();
});

test('the landing page fits a 360 px phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the landing page has no serious accessibility violation (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
      );
    expect(serious).toEqual([]);
  });
}
