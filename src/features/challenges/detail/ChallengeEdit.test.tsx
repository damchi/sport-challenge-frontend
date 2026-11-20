import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ChallengeDetail, ChallengeUpdate } from '../../../api/hooks/useChallenges';
import { mockChallengeDetail, mockChallenges } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { routes } from '../../../routes/routes';
import { AppProviders } from '../../../test/AppProviders';
import { createFakeAuth } from '../../../test/fakeAuth';

const summary = mockChallenges[1];
if (!summary) throw new Error('No mock challenge');
const id = summary.id;

// An ongoing challenge of Montréal, created by the user.
const base: ChallengeDetail = {
  ...mockChallengeDetail(summary),
  title: 'Défi de novembre',
  description: 'Bougez !',
  visibility: 'private',
  status: 'ongoing',
  my_role: 'creator',
  my_status: 'active',
  can_join: false,
};

const OPEN = 'Modifier le titre et la description';

let updates: ChallengeUpdate[] = [];

function answer(detail: Partial<ChallengeDetail>) {
  server.use(
    http.get('*/api/v1/challenges/:challengeId', () =>
      HttpResponse.json<ChallengeDetail>({ ...base, ...detail }),
    ),
  );
}

function updateAnswers(response: (update: ChallengeUpdate) => Response) {
  server.use(
    http.patch('*/api/v1/challenges/:challengeId', async ({ request }) => {
      const update = (await request.json()) as ChallengeUpdate;
      updates.push(update);
      return response(update);
    }),
  );
}

function renderChallenge() {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...new Intl.DateTimeFormat('fr').resolvedOptions(),
    timeZone: 'America/Montreal',
  });
  const router = createMemoryRouter(routes, { initialEntries: [`/challenges/${id}`] });
  render(
    <AppProviders auth={createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

async function openForm() {
  renderChallenge();
  fireEvent.click(await screen.findByRole('button', { name: OPEN }));
  return screen.getByRole('form', { name: 'Modifier le défi' });
}

beforeEach(() => {
  updates = [];
  answer({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChallengeEdit', () => {
  it.each(['upcoming', 'ongoing', 'finished'] as const)(
    'is offered to a creator of an %s challenge',
    async (status) => {
      answer({ status });
      renderChallenge();

      expect(await screen.findByRole('button', { name: OPEN })).toBeInTheDocument();
    },
  );

  it.each(['participant', 'abandoned', 'invited', 'outsider'] as const)(
    'is not offered to a user whose role is %s',
    async (role) => {
      answer({ my_role: role, my_status: role === 'participant' ? 'active' : null });
      renderChallenge();

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Défi de novembre' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: OPEN })).not.toBeInTheDocument();
    },
  );

  it('edits only the title and the description, the rest shown read only', async () => {
    const form = await openForm();

    const title = within(form).getByRole('textbox', { name: 'Titre' });
    expect(title).toHaveValue('Défi de novembre');
    await vi.waitFor(() => expect(title).toHaveFocus());
    expect(within(form).getByRole('textbox', { name: 'Description (facultative)' })).toHaveValue(
      'Bougez !',
    );
    expect(within(form).getAllByRole('textbox')).toHaveLength(2);
    expect(within(form).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(form).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      within(form).getByText(
        'Les dates, la visibilité et les catégories sont fixées à la création : elles ne changent plus. Seuls le titre et la description peuvent être modifiés.',
      ),
    ).toBeInTheDocument();
    expect(within(form).getByText('Du 2 nov. au 29 nov.')).toBeInTheDocument();
    expect(within(form).getByText('Privé')).toBeInTheDocument();
  });

  it('checks the fields as they are filled in and sends nothing invalid', async () => {
    updateAnswers(() => HttpResponse.json(base));
    const form = await openForm();
    const title = within(form).getByRole('textbox', { name: 'Titre' });

    fireEvent.change(title, { target: { value: ' ab ' } });
    fireEvent.blur(title);

    expect(
      await within(form).findByText('Le titre doit faire entre 3 et 80 caractères.'),
    ).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(within(form).getByRole('textbox', { name: 'Description (facultative)' }), {
      target: { value: 'a'.repeat(2001) },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));

    expect(
      await within(form).findByText('La description doit faire 2000 caractères au plus.'),
    ).toBeInTheDocument();
    expect(updates).toHaveLength(0);

    fireEvent.change(title, { target: { value: 'Défi de décembre' } });
    await vi.waitFor(() =>
      expect(
        within(form).queryByText('Le titre doit faire entre 3 et 80 caractères.'),
      ).not.toBeInTheDocument(),
    );
  });

  it('saves the title and the description, then shows them', async () => {
    updateAnswers((update) =>
      HttpResponse.json<ChallengeDetail>({
        ...base,
        title: update.title ?? base.title,
        description: update.description || null,
      }),
    );
    const form = await openForm();

    fireEvent.change(within(form).getByRole('textbox', { name: 'Titre' }), {
      target: { value: '  Défi de décembre ' },
    });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Description (facultative)' }), {
      target: { value: '' },
    });
    answer({ title: 'Défi de décembre', description: null });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));

    // The form closes once the lists have reloaded too.
    expect(await screen.findByText('Titre et description enregistrés.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Défi de décembre' })).toBeInTheDocument();
    expect(updates).toEqual([{ title: 'Défi de décembre', description: '' }]);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByText('Bougez !')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: OPEN })).toHaveFocus();
  });

  it('closes without sending on cancel, the focus back on the button', async () => {
    const form = await openForm();

    fireEvent.change(within(form).getByRole('textbox', { name: 'Titre' }), {
      target: { value: 'Autre titre' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Défi de novembre' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: OPEN })).toHaveFocus();
    expect(updates).toHaveLength(0);
  });

  it('translates a frozen field refused by the server', async () => {
    updateAnswers(() =>
      HttpResponse.json(
        {
          error: {
            code: 'field_not_editable',
            message: 'visibility is frozen',
            params: { fields: 'visibility' },
          },
        },
        { status: 422 },
      ),
    );
    const form = await openForm();

    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      "Seuls le titre et la description d'un défi peuvent être modifiés.",
    );
    expect(screen.queryByText('visibility is frozen')).not.toBeInTheDocument();
  });

  it('shows a field refused by the server where it is entered', async () => {
    updateAnswers(() =>
      HttpResponse.json(
        { error: { code: 'validation_failed', message: 'bad', params: { fields: 'title' } } },
        { status: 400 },
      ),
    );
    const form = await openForm();

    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));

    expect(
      await within(form).findByText('Valeur refusée. Vérifie-la, puis réessaie.'),
    ).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: 'Titre' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
