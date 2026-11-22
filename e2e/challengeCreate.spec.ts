import { expect, signInAt, test } from './fixtures';

test('a user creates a challenge and lands on its page', async ({ page }) => {
  await signInAt(page, '/challenges/new');

  await page.getByRole('textbox', { name: 'Titre' }).fill('Défi de décembre');
  await page.getByRole('radio', { name: 'Privé' }).check();
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Durée et fuseau' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Durée (en semaines)' }).fill('4');
  await page.getByLabel('Date de début').fill('2026-11-23');
  await expect(page.getByRole('combobox', { name: 'Fuseau horaire' })).toHaveValue(
    'America/Toronto',
  );
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Catégories' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Sport de référence' }).selectOption('ride');
  await page.getByRole('checkbox', { name: 'Ajouter la distance cumulée' }).check();
  await expect(page.getByRole('spinbutton', { name: 'Course' })).toHaveValue('1');
  await page.getByRole('checkbox', { name: "Ajouter l'élimination" }).check();
  await page.getByRole('spinbutton', { name: 'Incrément X (en km)' }).fill('2');
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Récapitulatif' })).toBeVisible();
  const creation = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/challenges'),
  );
  await page.getByRole('button', { name: 'Créer le défi' }).click();

  expect((await creation).postDataJSON()).toMatchObject({
    title: 'Défi de décembre',
    visibility: 'private',
    weeks: 4,
    start_date: '2026-11-23',
    timezone: 'America/Toronto',
    reference_sport: 'ride',
    categories: { cumulative_distance: {}, elimination: { step_meters: 2000 } },
  });
  // The mocks answer the creation with the id of their first challenge.
  await expect(page).toHaveURL('/challenges/00000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { level: 1, name: 'Défi 1' })).toBeVisible();
});
