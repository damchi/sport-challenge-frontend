import { http, HttpResponse } from 'msw';
import {
  mockChallengeDetail,
  mockChallenges,
  mockInvitationToken,
  mockInvitedChallengeId,
} from '../src/mocks/handlers';
import { expect, signInAt, test } from './fixtures';

test('a friend opens an invitation link, signs in and joins the challenge', async ({
  network,
  page,
}) => {
  const invited = mockChallenges.find((challenge) => challenge.id === mockInvitedChallengeId);
  if (!invited) throw new Error('No invited challenge in the mocks');
  let joined = false;
  network.use(
    http.post('*/api/v1/invitations/accept', () => {
      joined = true;
      // Falls through to the mock's answer.
      return undefined;
    }),
    http.get(`*/api/v1/challenges/${mockInvitedChallengeId}`, () =>
      HttpResponse.json({
        ...mockChallengeDetail(invited),
        ...(joined && { my_role: 'participant', my_status: 'active', can_join: false }),
      }),
    ),
  );

  // The token stays in the fragment through the sign-in.
  await signInAt(page, `/invite#${mockInvitationToken}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Invitation' })).toBeVisible();
  await expect(page.getByText("On t'invite à rejoindre ce défi.")).toBeVisible();
  await expect(page.getByRole('heading', { name: invited.title })).toBeVisible();
  await page.getByRole('button', { name: "Accepter l'invitation" }).click();

  await expect(page).toHaveURL(`/challenges/${mockInvitedChallengeId}`);
  await expect(page.getByText('Tu participes à ce défi.')).toBeVisible();
  expect(joined).toBe(true);
});

test('an invalid invitation link says so', async ({ page }) => {
  await signInAt(page, '/invite#not-a-valid-token');

  await expect(page.getByRole('alert')).toHaveText(
    "Ce lien d'invitation n'est pas valide ou a expiré. Demande un nouveau lien à la personne qui te l'a envoyé.",
  );
});
