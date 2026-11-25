import { zodResolver } from '@hookform/resolvers/zod';
import { Ban, Pencil, Trash2, UserCheck } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  useAdminAccountChange,
  type AdminAccountChange,
  type AdminProfileUpdate,
} from '../../api/hooks/admin/adminAccounts';
import type { AdminUser } from '../../api/hooks/admin/useAdminUsers';
import { identitySchema, identityUpdate, type IdentityInput } from '../../domain/schemas/profile';
import { NameInput } from '../profile/NameInput';
import { fieldErrors } from '../profile/profileErrors';
import { ReasonDialog } from './ReasonDialog';

/** What the changes of an account place in its sheet. */
export interface AccountParts {
  /** "Modifier le profil", by the title. */
  edit: ReactNode;
  /** The form of the profile, while it is open. */
  form: ReactNode;
  /** Block or unblock, and delete: last on the sheet. */
  danger: ReactNode;
  /** Another change of the sheet starts: what was said of the last one goes. */
  dismiss: () => void;
}

type Kind = AdminAccountChange['kind'];

const OUTLINE =
  'inline-flex h-11 items-center gap-2 self-start rounded-full border bg-surface px-5 font-bold hover-fill';

/**
 * The changes an admin makes to an account (mockup « Fiche d'un compte »):
 * its pseudo and names, with the rules of the profile; block or unblock it;
 * delete it. Each asks for the reason in a dialog ("danger" to block or
 * delete), then is made at once: none judges a challenge again. A pseudo or
 * a name the server refuses goes back to the form, by its field. Kept above
 * the sheet, so that the change made is said once the sheet is read again.
 * A deleted account changes no more: `children` gets no parts.
 */
export function AdminAccountChanges({
  user,
  name,
  children,
}: {
  user: AdminUser;
  name: string;
  children: (parts: AccountParts | null) => ReactNode;
}) {
  const { t } = useTranslation();
  const mutation = useAdminAccountChange(user.id);
  const [editing, setEditing] = useState(false);
  const [asked, setAsked] = useState<AdminAccountChange | null>(null);
  const [closing, setClosing] = useState(false);
  // The change made, and the name the account had when it was asked.
  const [made, setMade] = useState<{ kind: Kind; name: string } | null>(null);
  // What the server refused in the form: shown by its fields.
  const [refused, setRefused] = useState<unknown>(undefined);
  const outcome = useRef<HTMLParagraphElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);

  // Back on the sheet after a change: the focus goes to what it says.
  useEffect(() => {
    if (made) outcome.current?.focus();
  }, [made]);

  const ask = (change: AdminAccountChange) => {
    mutation.reset();
    setClosing(false);
    setMade(null);
    setAsked(change);
  };

  const confirm = (reason: string) => {
    if (!asked) return;
    const change = asked;
    void mutation.mutateAsync({ change, reason }).then(
      () => {
        // Kept unavailable until the dialog closes: the change is made.
        setClosing(true);
        setAsked(null);
        if (change.kind === 'update') setEditing(false);
        setMade({ kind: change.kind, name });
      },
      (error: unknown) => {
        // A refused field is said by the field, the dialog closed; anything
        // else is said in the dialog.
        if (change.kind === 'update' && fieldErrors(error).length > 0) {
          setAsked(null);
          setRefused(error);
        }
      },
    );
  };

  const active = user.deleted_at === null;
  const blocked = user.state === 'blocked';
  const kind = asked?.kind;
  const words = (key: string) => (kind ? t(`admin.account.${kind}.${key}`, { name }) : '');

  const parts: AccountParts | null = active
    ? {
        // Kept in sight while the form is open, which it opens and closes.
        edit: (
          <button
            ref={editButton}
            type="button"
            aria-expanded={editing}
            aria-controls="admin-profile-form"
            onClick={() => {
              setMade(null);
              setRefused(undefined);
              setEditing(!editing);
            }}
            className={`${OUTLINE} border-border`}
          >
            <Pencil aria-hidden="true" size={18} />
            {t('admin.account.update.button')}
          </button>
        ),
        form: editing && (
          <ProfileForm
            user={user}
            refused={refused}
            onSubmit={(update) => ask({ kind: 'update', update })}
            onCancel={() => {
              setEditing(false);
              editButton.current?.focus();
            }}
          />
        ),
        danger: (
          <section className="flex flex-col gap-3 rounded-card border border-dashed border-border-dashed p-4 lg:p-5">
            <h3 className="font-display text-lg font-bold">
              {t(`admin.account.${blocked ? 'unblock' : 'block'}.title`)}
            </h3>
            <p className="text-muted">
              {t(`admin.account.${blocked ? 'unblock' : 'block'}.help`, { name })}
            </p>
            <button
              type="button"
              onClick={() => ask({ kind: blocked ? 'unblock' : 'block' })}
              className={`${OUTLINE} ${blocked ? 'border-border' : 'border-danger text-danger'}`}
            >
              {blocked ? (
                <UserCheck aria-hidden="true" size={18} />
              ) : (
                <Ban aria-hidden="true" size={18} />
              )}
              {t(`admin.account.${blocked ? 'unblock' : 'block'}.button`)}
            </button>
            <hr className="my-2 border-t border-dashed border-border-dashed" />
            <h3 className="font-display text-lg font-bold">{t('admin.account.delete.title')}</h3>
            <p className="text-muted">{t('admin.account.delete.help')}</p>
            <button
              type="button"
              onClick={() => ask({ kind: 'delete' })}
              className={`${OUTLINE} border-danger text-danger`}
            >
              <Trash2 aria-hidden="true" size={18} />
              {t('admin.account.delete.button')}
            </button>
          </section>
        ),
        dismiss: () => setMade(null),
      }
    : null;

  return (
    <>
      <p
        ref={outcome}
        role="status"
        tabIndex={-1}
        className={
          made ? 'rounded-row bg-ok-bg px-4 py-3 font-semibold text-ok-fg outline-none' : 'sr-only'
        }
      >
        {made && t(`admin.account.${made.kind}.made`, { name: made.name })}
      </p>
      {children(parts)}
      <ReasonDialog
        open={asked !== null}
        title={words('reasonTitle')}
        summary={words('summary')}
        details={asked?.kind === 'update' && <UpdateDetails user={user} update={asked.update} />}
        confirmLabel={words('confirm')}
        variant={kind === 'block' || kind === 'delete' ? 'danger' : 'default'}
        errorScope="admin.account.errors"
        pending={mutation.isPending || closing}
        error={mutation.error}
        onConfirm={confirm}
        onCancel={() => {
          mutation.reset();
          setAsked(null);
        }}
      />
    </>
  );
}

/** The fields an update changes, each before and after. */
function UpdateDetails({ user, update }: { user: AdminUser; update: AdminProfileUpdate }) {
  const { t } = useTranslation();
  const missing = t('admin.users.sheet.missing');
  const rows = (
    [
      ['firstName', 'first_name'],
      ['lastName', 'last_name'],
      ['pseudo', 'pseudo'],
    ] as const
  ).flatMap(([label, field]) =>
    field in update
      ? [
          {
            label: t(`admin.users.sheet.${label}`),
            before: user[field] ?? missing,
            after: update[field] ?? missing,
          },
        ]
      : [],
  );
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {rows.map(({ label, before, after }) => (
        <li key={label} className="break-words">
          {t('admin.account.update.field', { label, before, after })}
        </li>
      ))}
    </ul>
  );
}

/**
 * The pseudo and the names of the account, with the rules of the profile:
 * names required, an emptied pseudo removed. Only what changed is sent,
 * once the reason is given; "Enregistrer" waits for a change.
 */
function ProfileForm({
  user,
  refused,
  onSubmit,
  onCancel,
}: {
  user: AdminUser;
  refused: unknown;
  onSubmit: (update: AdminProfileUpdate) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors },
  } = useForm<IdentityInput>({
    resolver: zodResolver(identitySchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      pseudo: user.pseudo ?? '',
    },
  });
  const [firstName, lastName, pseudo] = useWatch({
    control,
    name: ['first_name', 'last_name', 'pseudo'],
  });
  const unchanged =
    Object.keys(identityUpdate({ first_name: firstName, last_name: lastName, pseudo }, user))
      .length === 0;

  // Opened to type in it.
  useEffect(() => {
    setFocus('first_name');
  }, [setFocus]);

  // What the server refused goes to its field, the first one focused.
  useEffect(() => {
    fieldErrors(refused).forEach(([field, message], index) =>
      setError(field, { message }, { shouldFocus: index === 0 }),
    );
  }, [refused, setError]);

  const pseudoMessage = errors.pseudo?.message;
  const describedBy = ['admin-pseudo-hint', pseudoMessage && 'admin-pseudo-error']
    .filter(Boolean)
    .join(' ');

  return (
    <section
      id="admin-profile-form"
      aria-labelledby="admin-profile-form-title"
      className="rounded-card border border-border bg-surface p-4 lg:p-5"
    >
      <h3 id="admin-profile-form-title" className="font-display text-lg font-bold">
        {t('admin.account.update.button')}
      </h3>
      <form
        noValidate
        onSubmit={(event) =>
          void handleSubmit((typed) => onSubmit(identityUpdate(typed, user)))(event)
        }
        className="mt-4 flex flex-col gap-5"
      >
        <div className="grid gap-5 md:grid-cols-2 md:gap-4">
          <NameInput
            name="first_name"
            label={t('onboarding.firstName')}
            autoComplete="off"
            message={errors.first_name?.message}
            registration={register('first_name')}
          />
          <NameInput
            name="last_name"
            label={t('onboarding.lastName')}
            autoComplete="off"
            message={errors.last_name?.message}
            registration={register('last_name')}
          />
        </div>
        <div>
          <label htmlFor="admin-pseudo" className="block text-sm font-semibold">
            {t('onboarding.pseudo.label')}
          </label>
          <input
            id="admin-pseudo"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={pseudoMessage ? true : undefined}
            aria-describedby={describedBy}
            className="mt-2 h-11 w-full rounded-row border border-border bg-surface px-3 text-ink"
            {...register('pseudo')}
          />
          <p id="admin-pseudo-hint" className="mt-1 text-sm text-muted">
            {t('admin.account.update.pseudoHint')}
          </p>
          {pseudoMessage && (
            <p id="admin-pseudo-error" role="alert" className="mt-1 text-sm text-risk-fg">
              {t(pseudoMessage)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-full border border-border bg-surface px-6 font-bold hover-fill"
          >
            {t('admin.reason.cancel')}
          </button>
          <button
            type="submit"
            disabled={unchanged}
            className="h-12 rounded-full bg-accent px-6 font-bold text-on-accent hover-accent disabled:opacity-60"
          >
            {t('admin.account.update.save')}
          </button>
        </div>
      </form>
    </section>
  );
}
