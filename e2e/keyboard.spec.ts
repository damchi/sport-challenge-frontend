import type { Page } from '@playwright/test';
import { expect, signInAt, test } from './fixtures';

/**
 * Presses Tab until the control named `name` has the focus and returns the
 * controls met on the way, in order. Each one shows the focus ring.
 */
async function tabTo(page: Page, name: string): Promise<string[]> {
  const met: string[] = [];
  for (let step = 0; step < 30; step += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return undefined;
      // A field's own label, or the one around it (a sport's chip).
      const label =
        (element.id ? document.querySelector(`label[for="${element.id}"]`) : null) ??
        element.closest('label');
      return {
        // A control named apart from its text (a shortened label on a phone).
        name: element.getAttribute('aria-label') ?? (label ?? element).textContent?.trim() ?? '',
        // Not :focus while on a date field's own picker button, which the
        // browser rings itself.
        ring:
          !element.matches(':focus') && element.matches('input[type="date"]')
            ? 'solid 2px'
            : `${getComputedStyle(element).outlineStyle} ${getComputedStyle(element).outlineWidth}`,
      };
    });
    if (!focused) throw new Error(`The focus left the page after: ${met.join(' › ')}`);
    expect(focused.ring, `focus ring of "${focused.name}"`).toBe('solid 2px');
    // A date field keeps the focus across its parts (day, month, time).
    if (met.at(-1) !== focused.name) met.push(focused.name);
    if (focused.name === name) return met;
  }
  throw new Error(`"${name}" never got the focus; met: ${met.join(' › ')}`);
}

test('a user records an activity with the keyboard only', async ({ page, isMobile }) => {
  await signInAt(page, '/');
  await expect(page.getByRole('heading', { level: 1, name: 'Défis' })).toBeVisible();

  // The main navigation comes first (the app name is shown from a tablet).
  expect(await tabTo(page, 'Activités')).toEqual(
    isMobile ? ['Défis', 'Activités'] : ['Sport Challenge', 'Défis', 'Activités'],
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Mes activités' })).toBeFocused();

  // The focus moved to the new page's title: Tab goes on with its content.
  expect(await tabTo(page, 'Ajouter une activité')).toEqual(['Ajouter une activité']);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Ajouter une activité' })).toBeFocused();
  // The form shows once its sports are loaded.
  await expect(page.getByRole('group', { name: 'Sport' })).toBeVisible();

  // The form, field after field: the sports are one stop, Space picks one.
  expect(await tabTo(page, 'Course')).toEqual(['Course']);
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'Course' })).toBeChecked();
  expect(await tabTo(page, 'Date')).toEqual(['Date']);
  // The order of the date's parts (day, month, year) depends on the system:
  // the value is set directly, the field is still left with Tab.
  await page.getByLabel('Date', { exact: true }).fill('2026-11-19');
  expect(await tabTo(page, 'Heure')).toEqual(['Date', 'Heure']);
  // The time is typed on 24 hours.
  await page.keyboard.type('7h30');
  expect(await tabTo(page, 'Minutes')).toEqual(['Heures', 'Minutes']);
  await expect(page.getByLabel('Heure', { exact: true })).toHaveValue('07:30');
  await page.keyboard.type('45');
  expect(await tabTo(page, 'Distance en kilomètres')).toEqual([
    'Secondes',
    'Distance en kilomètres',
  ]);
  await page.keyboard.type('8,2');
  expect(await tabTo(page, "Enregistrer l'activité")).toEqual(["Enregistrer l'activité"]);
  const recording = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/activities'),
  );
  await page.keyboard.press('Enter');

  expect((await recording).postDataJSON()).toMatchObject({
    sport_code: 'run',
    // 7:30 in Montréal.
    started_at: '2026-11-19T12:30:00.000Z',
    duration_seconds: 2700,
    distance_meters: 8200,
  });
  await expect(page.getByText('Activité enregistrée.')).toBeVisible();
});
