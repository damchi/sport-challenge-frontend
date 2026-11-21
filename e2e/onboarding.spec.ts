import { http, HttpResponse } from 'msw';
import { mockMe } from '../src/mocks/handlers';
import { expect, signInAt, test } from './fixtures';

test('a new user signs in, fills in the profile and reaches the challenges', async ({
  network,
  page,
}) => {
  let profile = {
    ...mockMe,
    pseudo: null,
    first_name: null,
    last_name: null,
    language: null,
    profile_complete: false,
  };
  network.use(
    http.get('*/api/v1/me', () => HttpResponse.json(profile)),
    http.patch('*/api/v1/me', async ({ request }) => {
      const update = (await request.json()) as Partial<typeof profile>;
      profile = { ...profile, ...update, profile_complete: true };
      return HttpResponse.json(profile);
    }),
  );

  await signInAt(page, '/');

  await expect(page.getByRole('heading', { level: 1, name: 'Bienvenue' })).toBeVisible();
  await expect(page).toHaveURL('/onboarding');
  await page.getByLabel('Pseudo (facultatif)').fill('marie_92');
  await page.getByLabel('Prénom').fill('Marie');
  await page.getByLabel('Nom', { exact: true }).fill('Tremblay');
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Défis' })).toBeVisible();
  expect(profile).toMatchObject({ pseudo: 'marie_92', first_name: 'Marie', last_name: 'Tremblay' });
});
