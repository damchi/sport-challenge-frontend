import { http, HttpResponse } from 'msw';
import { mockChallengeDetail, mockChallenges } from '../src/mocks/handlers';
import { expect, signInAt, test } from './fixtures';

test('a user joins a public challenge from its page', async ({ network, page }) => {
  const open = mockChallenges.find(
    (challenge) =>
      challenge.visibility === 'public' &&
      challenge.status === 'upcoming' &&
      challenge.my_role === 'outsider',
  );
  if (!open) throw new Error('No public challenge to join in the mocks');
  let joined = false;
  network.use(
    http.post(`*/api/v1/challenges/${open.id}/join`, () => {
      joined = true;
      // Falls through to the mock's answer.
      return undefined;
    }),
    // The server keeps the registration: read again, the challenge says so.
    http.get(`*/api/v1/challenges/${open.id}`, () =>
      HttpResponse.json({
        ...mockChallengeDetail(open),
        ...(joined && { my_role: 'participant', my_status: 'active', can_join: false }),
      }),
    ),
  );
  await signInAt(page, `/challenges/${open.id}`);

  await page.getByRole('button', { name: 'Rejoindre le défi' }).click();
  const dialog = page.getByRole('dialog', { name: `Rejoindre « ${open.title} » ?` });
  await dialog.getByRole('button', { name: 'Rejoindre', exact: true }).click();

  await expect(page.getByText('Tu participes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejoindre le défi' })).toBeHidden();
  expect(joined).toBe(true);
});
