import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import { Sheet } from './Sheet';

function renderSheet(onClose = vi.fn()) {
  renderWithProviders(
    <Sheet open title="Points" onClose={onClose}>
      <p>Content</p>
    </Sheet>,
  );
  return onClose;
}

describe('Sheet', () => {
  it('closes on a tap outside the panel', () => {
    const onClose = renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Points' });
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open after a press that began inside the panel', () => {
    const onClose = renderSheet();
    fireEvent.pointerDown(screen.getByText('Content'));
    fireEvent.click(screen.getByRole('dialog', { name: 'Points' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes with its button and on Escape', () => {
    const onClose = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
