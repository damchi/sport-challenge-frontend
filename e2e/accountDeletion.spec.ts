import { FAKE_SIGN_IN } from './fakeAuth0';
import { expect, signInAt, test } from './fixtures';

test('a user deletes the account and ends signed out', async ({ page }) => {
  await signInAt(page, '/me');

  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer ton compte ?' });
  await dialog.getByRole('checkbox', { name: "Je comprends que c'est définitif." }).check();
  await dialog.getByRole('button', { name: 'Supprimer mon compte' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Compte supprimé' })).toBeVisible();
  await page.getByRole('button', { name: 'Terminer' }).click();

  // Signed out at Auth0 too: the app asks for a new sign-in.
  await expect(page.getByRole('link', { name: FAKE_SIGN_IN })).toBeVisible();
});
