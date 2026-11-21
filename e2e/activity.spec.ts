import { expect, signInAt, test } from './fixtures';

test('a user records an activity with an idempotency key', async ({ page }) => {
  await signInAt(page, '/activities/new');

  await page.getByRole('combobox', { name: 'Sport' }).selectOption({ label: 'Course' });
  await page.getByLabel('Début').fill('2026-11-19T07:30');
  await page.getByRole('textbox', { name: 'Minutes' }).fill('45');
  await page.getByRole('textbox', { name: 'Distance (km)' }).fill('8,2');
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
