import indexCss from './index.css?raw';

// The hover rules of design.md (« Boutons »), read from the stylesheet: jsdom
// neither hovers nor evaluates media queries.
function block(name: string): string {
  const start = indexCss.indexOf(name);
  if (start < 0) throw new Error(`No ${name} in index.css`);
  const end = indexCss.indexOf('\n}\n', start);
  return indexCss.slice(start, end);
}

describe('hover styles', () => {
  it('only hover on a device that hovers, never a disabled or busy control', () => {
    const variant = block('@custom-variant enabled-hover');

    expect(variant).toContain("&:not(:disabled, [aria-disabled='true'], [aria-busy='true'])");
    expect(variant).toContain('@media (hover: hover)');
  });

  it('keeps the default cursor on a disabled or busy button', () => {
    expect(indexCss).toMatch(
      /button:not\(:disabled, \[aria-disabled='true'\], \[aria-busy='true'\]\)\s*\{\s*cursor: pointer;/,
    );
  });

  it.each([
    ['hover-accent', 'background-color: var(--color-accent-hover)'],
    ['hover-danger', 'background-color: var(--color-danger-hover)'],
    ['hover-fill', 'background-color: var(--color-segment)'],
    ['hover-fill-raised', 'background-color: var(--color-track-raised)'],
    ['hover-border', 'border-color: var(--color-muted)'],
  ])('%s takes a token through the shared variant, without motion when reduced', (name, rule) => {
    const utility = block(`@utility ${name} {`);

    expect(utility).toContain('@variant enabled-hover');
    expect(utility).toContain(rule);
    expect(utility).toMatch(/@variant motion-reduce \{\s*transition: none;/);
  });
});
