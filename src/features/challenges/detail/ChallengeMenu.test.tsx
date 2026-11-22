import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges } from '../../../mocks/handlers';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';
import { ChallengeMenu, type MenuAction } from './ChallengeMenu';

const found = mockChallenges[1];
if (!found) throw new Error('No mock challenge');
const summary = found;

function renderMenu(detail: Partial<ChallengeDetail>, onSelect = vi.fn()) {
  const buttonRef = createRef<HTMLButtonElement>();
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <ChallengeMenu
        challenge={{ ...mockChallengeDetail(summary), status: 'ongoing', ...detail }}
        buttonRef={buttonRef}
        onSelect={onSelect}
      />
      <p>elsewhere</p>
    </AppProviders>,
  );
  return onSelect;
}

const menuButton = () => screen.getByRole('button', { name: "Plus d'actions" });
const itemNames = () =>
  screen
    .getAllByRole('button')
    .filter((button) => button !== menuButton())
    .map((button) => button.textContent);

describe('ChallengeMenu', () => {
  it.each([
    [
      'an active creator',
      { my_role: 'creator', my_status: 'active' },
      ['Modifier le titre et la description', 'Supprimer le défi', 'Abandonner le défi'],
    ],
    [
      'a creator who abandoned',
      { my_role: 'creator', my_status: 'abandoned' },
      ['Modifier le titre et la description', 'Supprimer le défi'],
    ],
    [
      'an active participant',
      { my_role: 'participant', my_status: 'active' },
      ['Abandonner le défi'],
    ],
    [
      'a creator of a finished challenge',
      { my_role: 'creator', my_status: 'active', status: 'finished' },
      ['Modifier le titre et la description', 'Supprimer le défi'],
    ],
  ] as const)('offers the actions of %s', async (_, detail, names) => {
    renderMenu(detail);

    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(itemNames()).toEqual(names);
  });

  it.each([
    ['a visitor', { my_role: 'outsider', my_status: null }],
    ['a participant who abandoned', { my_role: 'abandoned', my_status: 'abandoned' }],
    ['a participant of a finished challenge', { status: 'finished', my_status: 'active' }],
  ] as const)('is not shown to %s', (_, detail) => {
    renderMenu({ my_role: 'participant', ...detail });

    expect(screen.queryByRole('button', { name: "Plus d'actions" })).not.toBeInTheDocument();
  });

  it('gives the focus to the first action, and Escape closes it back on its button', () => {
    renderMenu({ my_role: 'creator', my_status: 'active' });

    fireEvent.click(menuButton());
    const first = screen.getByRole('button', { name: 'Modifier le titre et la description' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveFocus();
  });

  it('closes on a click elsewhere', () => {
    renderMenu({ my_role: 'participant', my_status: 'active' });

    fireEvent.click(menuButton());
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when the focus moves out of it', () => {
    renderMenu({ my_role: 'participant', my_status: 'active' });

    fireEvent.click(menuButton());
    fireEvent.focusIn(screen.getByText('elsewhere'));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes and hands over the chosen action', () => {
    const onSelect = renderMenu({ my_role: 'creator', my_status: 'active' });

    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le défi' }));
    expect(onSelect).toHaveBeenCalledWith<[MenuAction]>('delete');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });
});
