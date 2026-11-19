import { fireEvent, render, screen } from '@testing-library/react';
import { SessionEndPage } from './SessionEndPage';

describe('SessionEndPage', () => {
  it('tells about a deleted account and offers to finish', () => {
    const onAction = vi.fn();
    render(<SessionEndPage reason="account_deleted" onAction={onAction} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Compte supprimé' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('offers to retry when the session could not be restored', () => {
    render(<SessionEndPage reason="unavailable" onAction={() => undefined} />);

    expect(screen.getByRole('alert')).toHaveTextContent("La connexion n'a pas pu être rétablie.");
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});
