import { fireEvent, render, screen } from '@testing-library/react';
import { SessionEndPage } from './SessionEndPage';

describe('SessionEndPage', () => {
  it('tells about a deleted account and offers to finish', () => {
    const onAction = vi.fn(() => Promise.resolve());
    render(<SessionEndPage reason="account_deleted" onAction={onAction} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Compte supprimé' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('confirms an account the user just deleted', () => {
    render(<SessionEndPage reason="account_deleted_by_user" onAction={() => Promise.resolve()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Compte supprimé' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ton compte a été supprimé. « Terminer » ferme ta session.',
    );
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeInTheDocument();
  });

  it('tells about a blocked account and offers to sign out', () => {
    const onAction = vi.fn(() => Promise.resolve());
    render(<SessionEndPage reason="account_blocked" onAction={onAction} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Compte bloqué' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "L'administrateur de l'app a bloqué ton compte",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('runs the action once, even on a double click', () => {
    const onAction = vi.fn(() => new Promise<void>(() => undefined));
    render(<SessionEndPage reason="account_deleted" onAction={onAction} />);

    const button = screen.getByRole('button', { name: 'Terminer' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });

  it('keeps the button when the action cannot start', async () => {
    render(
      <SessionEndPage reason="unavailable" onAction={() => Promise.reject(new Error('offline'))} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText("La connexion n'a pas abouti. Réessaie.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('offers to retry when the session could not be restored', () => {
    render(<SessionEndPage reason="unavailable" onAction={() => Promise.resolve()} />);

    expect(screen.getByRole('alert')).toHaveTextContent("La connexion n'a pas pu être rétablie.");
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});
