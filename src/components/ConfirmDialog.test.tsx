import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

function renderDialog(open: boolean) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const ui = (isOpen: boolean) => (
    <ConfirmDialog
      open={isOpen}
      title="Leave?"
      message="Your input will be lost."
      confirmLabel="Leave"
      cancelLabel="Stay"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
  const { rerender } = render(ui(open));
  return { onConfirm, onCancel, setOpen: (isOpen: boolean) => rerender(ui(isOpen)) };
}

describe('ConfirmDialog', () => {
  it('stays hidden while closed', () => {
    renderDialog(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with its title and message, the focus on the safe choice', () => {
    renderDialog(true);

    const dialog = screen.getByRole('dialog', { name: 'Leave?' });
    expect(dialog).toHaveAccessibleDescription('Your input will be lost.');
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus();
  });

  it('answers each button', () => {
    const { onConfirm, onCancel } = renderDialog(true);

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape and leaves the closing to its parent', () => {
    const { onCancel } = renderDialog(true);

    const escape = new Event('cancel', { cancelable: true });
    screen.getByRole('dialog').dispatchEvent(escape);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(escape.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes once its parent says so', () => {
    const { setOpen } = renderDialog(true);

    setOpen(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
