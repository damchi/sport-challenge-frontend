import { expect, signInAt, test } from './fixtures';

test('a user deletes the account and ends signed out', async ({ page }) => {
  await signInAt(page, '/me');

  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer ton compte ?' });
  await dialog.getByRole('checkbox', { name: "Je comprends que c'est définitif." }).check();
  await dialog.getByRole('button', { name: 'Supprimer mon compte' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Compte supprimé' })).toBeVisible();
  await page.getByRole('button', { name: 'Terminer' }).click();

  // Signed out at Auth0 too, and forgotten on this device: back to the
  // public landing page, not to a new sign-in.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Défie tes amis, semaine après semaine.' }),
  ).toBeVisible();
});
