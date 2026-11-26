import { mockActivities } from '../src/mocks/handlers';
import { expect, signInAt, test } from './fixtures';

test('a user records an activity with an idempotency key', async ({ page }) => {
  await signInAt(page, '/activities/new');

  await page
    .locator('label')
    .filter({ hasText: /^Course$/ })
    .click();
  await page.getByLabel('Date', { exact: true }).fill('2026-11-19');
  await page.getByRole('textbox', { name: 'Heure de début' }).fill('7');
  await page.getByRole('textbox', { name: 'Minutes de début' }).fill('30');
  await page.getByRole('textbox', { name: 'Minutes', exact: true }).fill('45');
  await page.getByRole('textbox', { name: 'Distance en kilomètres' }).fill('8,2');
  await expect(page.getByRole('region', { name: 'Résumé' })).toContainText('8,2');
  const recording = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/activities'),
  );
  await page.getByRole('button', { name: "Enregistrer l'activité" }).click();

  const request = await recording;
  expect(await request.headerValue('Idempotency-Key')).toMatch(/\S/);
  expect(request.postDataJSON()).toMatchObject({
    sport_code: 'run',
    // 7:30 in Montréal.
    started_at: '2026-11-19T12:30:00.000Z',
    duration_seconds: 2700,
    distance_meters: 8200,
  });
  await expect(page.getByText('Activité enregistrée.')).toBeVisible();
});

test('the lock of a judged week keeps its size, as the menu of the others', async ({ page }) => {
  // Run at 360 px (mobile project), where the lock shows alone, and on desktop.
  await signInAt(page, '/activities');

  const lock = page.getByText('Semaine jugée').first().locator('..');
  const menu = page.getByRole('button', { name: /Actions/ }).first();
  await expect(lock).toBeVisible();
  const row = (locator: typeof lock) => locator.locator('xpath=ancestor::article');
  const [lockBox, menuBox, lockRow, menuRow] = await Promise.all([
    lock.boundingBox(),
    menu.boundingBox(),
    row(lock).boundingBox(),
    row(menu).boundingBox(),
  ]);
  if (!lockBox || !menuBox || !lockRow || !menuRow) throw new Error('Not laid out');
  // A 44 px touch target, not stretched to the height of its row.
  expect(lockBox.height).toBeGreaterThanOrEqual(44);
  expect(lockBox.height).toBeLessThanOrEqual(menuBox.height);
  expect(lockBox.width).toBeGreaterThanOrEqual(44);
  // On a phone, at the top of its row, as the menu in its own, whatever their
  // heights (from `lg`, the rows center their action).
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    expect(Math.abs(lockBox.y - lockRow.y - (menuBox.y - menuRow.y))).toBeLessThanOrEqual(1);
  }
});

test('a user edits, then deletes an activity of this week', async ({ page }) => {
  const activity = mockActivities[0];
  if (!activity || activity.locked) throw new Error('No open activity in the mocks');
  await signInAt(page, '/activities');

  const menu = page.getByRole('button', { name: "Actions de l'activité" }).first();
  await menu.click();
  await page.getByRole('link', { name: 'Modifier' }).first().click();
  await expect(page).toHaveURL(`/activities/${activity.id}/edit`);
  await page.getByRole('textbox', { name: 'Distance en kilomètres' }).fill('9,5');
  const editing = page.waitForRequest((request) => request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  expect((await editing).postDataJSON()).toMatchObject({ distance_meters: 9500 });
  await expect(page.getByText('Activité modifiée.')).toBeVisible();

  // Back through the app: a reload would ask to sign in again (fakeAuth0.ts).
  await page.getByRole('link', { name: 'Retour à mes activités' }).click();
  await menu.click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).first().click();
  const deleting = page.waitForRequest((request) => request.method() === 'DELETE');
  await page.getByRole('button', { name: "Supprimer l'activité" }).click();
  expect((await deleting).url()).toMatch(new RegExp(`/api/v1/activities/${activity.id}$`));
  await expect(page.getByText('Activité supprimée.')).toBeVisible();
});
