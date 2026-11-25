import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '../../api/errors';
import { ReasonDialog } from './ReasonDialog';

function renderDialog(props: Partial<Parameters<typeof ReasonDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const ui = (open: boolean, more: typeof props = props) => (
    <ReasonDialog
      open={open}
      title="Exclure ami_4 ?"
      summary="ami_4 ne compte plus dans le classement."
      confirmLabel="Exclure"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...more}
    />
  );
  const { rerender } = render(ui(true));
  return {
    onConfirm,
    onCancel,
    rerender: (open: boolean, more?: typeof props) => rerender(ui(open, more)),
  };
}

const field = () => screen.getByRole('textbox', { name: 'Motif' });
const confirm = () => screen.getByRole('button', { name: 'Exclure' });
const type = (value: string) => fireEvent.change(field(), { target: { value } });

describe('ReasonDialog', () => {
  it('says what the change does, the focus on "Cancel"', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Exclure ami_4 ?' });
    expect(dialog).toHaveAccessibleDescription('ami_4 ne compte plus dans le classement.');
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();
    expect(field()).toHaveAccessibleDescription(
      'De 3 à 500 caractères. Il est gardé dans le journal.',
    );
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
  });

  it('keeps the confirmation unavailable under 3 characters', async () => {
    const { onConfirm } = renderDialog();

    type('ab');
    expect(await screen.findByText('2 / 500')).toBeInTheDocument();
    expect(confirm()).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
    // The hint says it already: no error under the field.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('confirms with 3 characters, trimmed', async () => {
    const { onConfirm } = renderDialog();

    type('  abc ');
    expect(await screen.findByText('3 / 500')).toBeInTheDocument();
    expect(confirm()).not.toHaveAttribute('aria-disabled');
    fireEvent.click(confirm());

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('abc'));
  });

  it('takes 500 characters, never more', async () => {
    renderDialog();

    type('a'.repeat(500));
    expect(await screen.findByText('500 / 500')).toBeInTheDocument();
    expect(confirm()).not.toHaveAttribute('aria-disabled');

    // Counted by code point, as the server does (no maxLength: UTF-16 units).
    type('a'.repeat(501));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le motif ne peut pas dépasser 500 caractères.',
    );
    expect(confirm()).toHaveAttribute('aria-disabled', 'true');
  });

  it('marks a deletion or a block as danger', () => {
    renderDialog({ variant: 'danger' });

    expect(confirm()).toHaveClass('bg-danger');
  });

  it('starts from an empty reason on each opening', async () => {
    const { rerender } = renderDialog();
    type('Séance oubliée');
    expect(await screen.findByText('14 / 500')).toBeInTheDocument();

    rerender(false);
    rerender(true);

    expect(await screen.findByText('0 / 500')).toBeInTheDocument();
    expect(field()).toHaveValue('');
  });

  it('cancels', () => {
    const { onCancel } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('says under the field a reason the server refused', () => {
    renderDialog({
      error: new ApiError('validation_failed', 400, { fields: 'reason' }),
    });

    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription(
      'De 3 à 500 caractères. Il est gardé dans le journal. Motif refusé : écris de 3 à 500 caractères, sans caractère invisible.',
    );
  });

  it('says any other error above the buttons, translated', () => {
    renderDialog({ error: new ApiError('challenge_not_found', 404) });

    expect(screen.getByRole('alert')).toHaveTextContent(/^Ce défi/);
    expect(field()).not.toHaveAttribute('aria-invalid');
  });

  it('says a busy refusal changed nothing', () => {
    renderDialog({ error: new ApiError('busy', 503) });

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Rien n'a été modifié : le service était occupé. Réessaie dans un instant.",
    );
  });

  it('waits while the change is sent', async () => {
    const { onConfirm } = renderDialog({ pending: true });

    type('abc');
    expect(await screen.findByText('3 / 500')).toBeInTheDocument();
    expect(confirm()).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
