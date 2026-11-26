import { http, HttpResponse } from 'msw';
import { mockAdminChallenges, mockMe, mockParticipants } from '../src/mocks/handlers';
import type { Page } from '@playwright/test';
import { expect, signInAt, test } from './fixtures';

const challenge = mockAdminChallenges[0];
const participant = mockParticipants[1];
if (!challenge || !participant?.pseudo) throw new Error('Missing mocks');
const name = participant.pseudo;

/** The files of the admin section, as the development server serves them. */
const ADMIN_CODE = /\/src\/(pages\/Admin|features\/admin\/|i18n\/admin\/|api\/hooks\/admin\/)/;

/** The admin files the page asks for, from now on. */
function adminFiles(page: Page): string[] {
  const loaded: string[] = [];
  page.on('request', (request) => {
    if (ADMIN_CODE.test(new URL(request.url()).pathname)) loaded.push(request.url());
  });
  return loaded;
}

test('an admin excludes a participant: preview, reason, then the sheet again', async ({
  network,
  page,
}) => {
  network.use(http.get('*/api/v1/me', () => HttpResponse.json({ ...mockMe, is_admin: true })));
  const loaded = adminFiles(page);
  await signInAt(page, '/admin/challenges');

  await page.getByRole('link', { name: challenge.title, exact: true }).click();
  const participants = page.getByRole('region', { name: 'Participants' });
  await participants.getByRole('button', { name: `Modifications pour ${name}` }).click();
  await participants.getByRole('button', { name: 'Exclure' }).click();

  // The preview: the participant leaves the rankings, nothing written yet.
  await expect(
    page.getByRole('heading', { level: 2, name: 'Aperçu des changements' }),
  ).toBeVisible();
  await expect(page.getByText("Rien n'est enregistré avant ta confirmation.")).toBeVisible();
  const line = page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name, exact: true }) });
  await expect(line.first()).toContainText('A abandonné');
  await page.getByRole('button', { name: 'Continuer' }).click();

  const dialog = page.getByRole('dialog', { name: "Confirmer l'exclusion" });
  await dialog.getByRole('textbox', { name: 'Motif' }).fill('Demande du créateur');
  const made = page.waitForRequest(
    (request) =>
      request.method() === 'DELETE' &&
      request.url().endsWith(`/participants/${participant.user_id}`) &&
      request.postDataJSON()?.dry_run === false,
  );
  await dialog.getByRole('button', { name: 'Exclure du défi' }).click();

  expect((await made).postDataJSON()).toEqual({ reason: 'Demande du créateur', dry_run: false });
  await expect(
    page.getByRole('status').filter({ hasText: `${name} a été exclu du défi.` }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: challenge.title })).toBeVisible();
  // What the other test looks for, loaded here.
  expect(loaded).not.toEqual([]);
});

test('anyone else gets the not found page, without the admin code', async ({ page }) => {
  const loaded = adminFiles(page);
  await signInAt(page, '/admin');

  await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
  expect(loaded).toEqual([]);
});
