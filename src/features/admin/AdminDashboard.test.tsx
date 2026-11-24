import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { mockAdminStats } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { AppProviders } from '../../test/AppProviders';
import { createFakeAuth } from '../../test/fakeAuth';
import { AdminDashboard } from './AdminDashboard';

// The device's time zone, fixed: the times below are Montreal's.
beforeEach(() => {
  const options = Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone: 'America/Montreal',
  });
});
afterEach(() => vi.restoreAllMocks());

function renderDashboard() {
  const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
  render(
    <AppProviders auth={auth}>
      <AdminDashboard />
    </AppProviders>,
  );
}

/** The value of the tile with this label. */
function figure(label: string) {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling?.textContent;
}

function workerRow(task: string) {
  const row = screen.getByRole('rowheader', { name: task }).closest('tr');
  if (!row) throw new Error(`No row for ${task}`);
  return within(row);
}

describe('AdminDashboard', () => {
  it('shows the figures counted by the server', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { level: 2, name: 'Comptes' })).toBeInTheDocument();
    expect(screen.getByText('Chiffres au 24 nov. 2026, 09:00')).toBeInTheDocument();
    expect(figure('Total')).toBe('1 284');
    expect(figure('Nouveaux sur 7 jours')).toBe('37');
    expect(figure('Actifs sur 7 jours')).toBe('412');
    expect(figure('À venir')).toBe('6');
    expect(figure('En cours')).toBe('21');
    expect(figure('Terminés')).toBe('143');
    expect(figure('Supprimés')).toBe('4');
    expect(figure('Activités sur 7 jours')).toBe('1 890');
    expect(figure('Suppressions Auth0 en attente')).toBe('2');
    expect(screen.getByText("Version de l'API : v1.4.0 (0123456)")).toBeInTheDocument();
  });

  it('shows each task of the worker, its last run and its last failure', async () => {
    renderDashboard();
    await screen.findByRole('table');

    const closing = workerRow('Clôture des semaines');
    expect(closing.getByText('Réussi')).toBeInTheDocument();
    expect(closing.getByText('Aucun')).toBeInTheDocument();
    expect(closing.queryByText('Échec')).not.toBeInTheDocument();

    // A failure is said in words, not by the red alone.
    const finalizing = workerRow('Fin des défis');
    expect(finalizing.getByText('Échec')).toBeInTheDocument();
    expect(finalizing.getByText('internal_error')).toBeInTheDocument();
    expect(finalizing.getAllByText('24 nov. 2026, 00:05')).toHaveLength(2);

    const deletions = workerRow('Suppressions Auth0');
    expect(deletions.getByText('Jamais')).toBeInTheDocument();
    expect(deletions.getByText('Aucun')).toBeInTheDocument();
  });

  it('says a run with no end is going on or was stopped', async () => {
    server.use(
      http.get('*/api/v1/admin/stats', () =>
        HttpResponse.json({
          ...mockAdminStats,
          worker_tasks: [{ task: 'close-weeks', last_run: { started_at: '2026-11-24T05:00:00Z' } }],
        }),
      ),
    );
    renderDashboard();

    expect(
      await screen.findByText('En cours ou interrompu', { selector: 'span' }),
    ).toBeInTheDocument();
  });

  it('shows the error and reloads on retry', async () => {
    server.use(
      http.get('*/api/v1/admin/stats', () =>
        HttpResponse.json({ error: { code: 'internal_error', message: 'boom' } }, { status: 500 }),
      ),
    );
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    );
    server.resetHandlers();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Comptes' })).toBeInTheDocument();
  });
});
