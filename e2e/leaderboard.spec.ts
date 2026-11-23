import { http, HttpResponse } from 'msw';
import { mockChallengeDetail, mockChallenges } from '../src/mocks/handlers';
import { expect, signInAt, test } from './fixtures';

// An ongoing challenge the user takes part in (week 3 of 4 in the mocks).
const CHALLENGE_ID = '00000000-0000-4000-8000-000000000005';
const found = mockChallenges.find((challenge) => challenge.id === CHALLENGE_ID);
if (!found) throw new Error('No ongoing challenge in the mocks');
const summary = found;

test('a participant reads the leaderboard and the statuses', async ({ page }) => {
  await signInAt(page, `/challenges/${CHALLENGE_ID}`);

  await expect(page.getByRole('heading', { level: 1, name: summary.title })).toBeVisible();
  await expect(page.getByText('Semaine 3 sur 4', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Semaine 3 · se termine /)).toBeVisible();
  const podium = page.getByRole('region', { name: 'Podium' });
  // Tied participants share the rank: 1, 1, 3.
  await expect(podium.getByRole('link', { name: /^1er ex æquo / })).toHaveCount(2);
  await expect(podium.getByRole('link', { name: /^1er ex æquo Toi / })).toBeVisible();
  await expect(podium.getByRole('link', { name: /^3e / })).toBeVisible();
  // Those who abandoned stay off the podium, listed in the full ranking only.
  await expect(podium.getByRole('link')).toHaveCount(3);
  await expect(podium.getByText('A abandonné')).toHaveCount(0);
  // Ten lines after the podium, then the next page, those who abandoned last.
  const leaderboard = page.getByRole('region', { name: 'Classement · Temps cumulé' });
  await expect(leaderboard.getByText('A abandonné')).toHaveCount(0);
  await leaderboard.getByRole('button', { name: 'Charger plus' }).click();
  await expect(leaderboard.getByText('A abandonné').first()).toBeVisible();
  await expect(podium.getByRole('link')).toHaveCount(3);

  // The cards of « Où tu en es » choose the category.
  const standings = page.getByRole('region', { name: 'Où tu en es' });
  const card = standings.getByRole('link', { name: /Vélo avec élimination/ });
  await card.click();
  await expect(card).toHaveAttribute('aria-current', 'true');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Classement · Vélo avec élimination' }),
  ).toBeVisible();
});

test('a participant abandons the challenge for good', async ({ network, page }) => {
  let abandoned = false;
  network.use(
    http.post(`*/api/v1/challenges/${CHALLENGE_ID}/abandon`, () => {
      abandoned = true;
      // Falls through to the mock's answer.
      return undefined;
    }),
    http.get(`*/api/v1/challenges/${CHALLENGE_ID}`, () =>
      HttpResponse.json({
        ...mockChallengeDetail(summary),
        ...(abandoned && { my_role: 'abandoned', my_status: 'abandoned' }),
      }),
    ),
  );
  await signInAt(page, `/challenges/${CHALLENGE_ID}`);

  await page.getByRole('button', { name: "Plus d'actions" }).click();
  await page.getByRole('button', { name: 'Abandonner le défi' }).click();
  const dialog = page.getByRole('dialog', { name: `Abandonner « ${summary.title} » ?` });
  await dialog.getByRole('button', { name: 'Abandonner', exact: true }).click();

  await expect(
    page.getByText("Tu as abandonné ce défi : c'est définitif, tu ne peux plus le rejoindre."),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: "Plus d'actions" })).toBeHidden();
  expect(abandoned).toBe(true);
});
