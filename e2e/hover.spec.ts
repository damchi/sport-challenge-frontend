import { expect, signInAt, test } from './fixtures';

// The hover of design.md (« Boutons »), in a real browser: jsdom has neither
// hover nor media queries.
test.use({ reducedMotion: 'reduce' });

const background = (element: Element) => getComputedStyle(element).backgroundColor;
const border = (element: Element) => getComputedStyle(element).borderTopColor;

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

  // A disabled or busy control keeps its look under the pointer.
  for (const attribute of ['aria-disabled', 'aria-busy']) {
    await button.evaluate((element, name) => element.setAttribute(name, 'true'), attribute);
    expect(await button.evaluate(background)).toBe(idle);
    await button.evaluate((element, name) => element.removeAttribute(name), attribute);
  }
});

test('a checked choice keeps its accent border under the pointer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'a touch device does not hover');
  await signInAt(page, '/challenges/new');
  const choice = page.locator('label').filter({ has: page.getByRole('radio', { name: /^Privé/ }) });
  await page.mouse.move(0, 0);
  const unchecked = await choice.evaluate(border);

  await choice.hover();
  expect(await choice.evaluate(border)).not.toBe(unchecked);

  await choice.click();
  await page.mouse.move(0, 0);
  const checked = await choice.evaluate(border);
  await choice.hover();
  expect(await choice.evaluate(border)).toBe(checked);
});
