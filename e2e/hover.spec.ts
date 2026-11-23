import { expect, signInAt, test } from './fixtures';

// The hover of design.md (« Boutons »), in a real browser: jsdom has neither
// hover nor media queries.
test.use({ reducedMotion: 'reduce' });

const background = (element: Element) => getComputedStyle(element).backgroundColor;

test('a button reacts to the pointer, unless it is disabled or the device cannot hover', async ({
  page,
}, testInfo) => {
  await signInAt(page, '/');
  const button = page.getByRole('link', { name: 'Créer un défi' }).first();
  await expect(button).toBeVisible();
  await page.mouse.move(0, 0);
  const idle = await button.evaluate(background);

  await button.hover();
  const hovered = await button.evaluate(background);

  if (testInfo.project.name === 'mobile') {
    // A touch device does not hover: nothing stays lit after a tap.
    expect(hovered).toBe(idle);
    return;
  }
  expect(hovered).not.toBe(idle);

  // A disabled (or busy) control keeps its look under the pointer.
  await button.evaluate((element) => element.setAttribute('aria-disabled', 'true'));
  expect(await button.evaluate(background)).toBe(idle);
});
