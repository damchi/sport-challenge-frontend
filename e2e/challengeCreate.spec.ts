import { expect, signInAt, test } from './fixtures';

// The fixtures fix the browser's clock (NOW, 19 November 2026): a first day
// after it, constant.
const FIRST_DAY = '2026-11-23';

test('a user creates a challenge and lands on its page', async ({ page }) => {
  await signInAt(page, '/challenges/new');

  await page.getByRole('textbox', { name: 'Titre' }).fill('Défi de décembre');
  await page.getByRole('radio', { name: 'Privé' }).check();
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Quand ça se passe' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Durée' }).fill('4');
  await page.getByLabel('Premier jour').fill(FIRST_DAY);
  await expect(page.getByRole('combobox', { name: 'Fuseau horaire' })).toHaveValue(
    'America/Toronto',
  );
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Comment on gagne' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Sport de référence' }).selectOption('ride');
  await page.getByRole('switch', { name: 'Distance cumulée' }).check();
  await page.getByRole('button', { name: 'Personnaliser' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Course' })).toHaveValue('1');
  await page.getByRole('switch', { name: 'Vélo avec élimination' }).check();
  await page
    .getByRole('spinbutton', { name: "Hausse minimale d'une semaine à l'autre (en km)" })
    .fill('2');
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Tout vérifier' })).toBeVisible();
  const creation = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/challenges'),
  );
  await page.getByRole('button', { name: 'Créer le défi' }).click();

  expect((await creation).postDataJSON()).toMatchObject({
    title: 'Défi de décembre',
    visibility: 'private',
    weeks: 4,
    start_date: FIRST_DAY,
    timezone: 'America/Toronto',
    reference_sport: 'ride',
    categories: { cumulative_distance: {}, elimination: { step_meters: 2000 } },
  });
  // The mocks answer the creation with the id of their first challenge.
  await expect(page).toHaveURL('/challenges/00000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { level: 1, name: 'Défi 1' })).toBeVisible();
});
