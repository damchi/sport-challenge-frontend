import { Crown, Ellipsis, Flag, Search, User, UserCheck, UserPlus, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  sendAdminParticipantChange,
  type AdminParticipantChange,
} from '../../api/hooks/admin/adminParticipants';
import type { CorrectionBody } from '../../api/hooks/admin/useAdminCorrection';
import { useAdminUsers } from '../../api/hooks/admin/useAdminUsers';
import { useParticipants, type Participant } from '../../api/hooks/useChallenges';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import type { ApiClient } from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { LoadMore } from '../../components/LoadMore';
import { StatusPill } from '../../components/StatusPill';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { participantChanges } from '../../domain/adminParticipants';
import { MAX_USER_SEARCH_LENGTH } from '../../domain/adminUsers';
import { displayName } from '../../domain/displayName';
import { challengeDay } from '../../domain/format/challengeDates';
import { usePageSize } from '../../lib/pageSize';
import { AdminTable } from './AdminTable';
import { CELL } from './adminCells';
import { PagedPart } from './PagedPart';
import { RecomputeFlow } from './RecomputeFlow';

/** The change asked, and the account it is made to. */
interface Target {
  change: AdminParticipantChange;
  userId: string;
  name: string;
}

/** What is open in the card: the search of an account, or a participant's changes. */
type Open = { kind: 'add' } | { kind: 'participant'; userId: string } | null;

const BUTTON =
  'inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-bold hover-fill';
const ERROR = 'text-sm font-semibold text-risk-fg';
const ICONS = {
  add: UserPlus,
  exclude: X,
  reinstate: UserCheck,
  makeCreator: Crown,
  removeCreator: Crown,
} as const;

/**
 * The participants of a challenge for the admin, and the changes made to
 * them (mockup « Fiche d'un défi »): add an account, exclude or reinstate a
 * participant, make one a creator or remove the role. Each change goes
 * through `RecomputeFlow` (preview, reason, confirmation, "danger" for an
 * exclusion), whose preview takes the place of the whole sheet: `children`
 * gets the card to place in it. What is open in the card, and the search, are
 * kept here, so that going back from the preview finds them again. Once a
 * change is made, the sheet comes back, read again, and says so.
 */
export function AdminParticipantChanges({
  challengeId,
  timeZone,
  children,
}: {
  challengeId: string;
  timeZone: string;
  children: (participants: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Open>(null);
  const [q, setQ] = useState<string | undefined>(undefined);
  const [target, setTarget] = useState<Target | null>(null);
  const [made, setMade] = useState<Target | null>(null);
  // Each change made starts a new flow, back on the sheet.
  const [round, setRound] = useState(0);
  // Read by `send` when the preview is asked, before the state is.
  const asked = useRef<Target | null>(null);

  const send = (client: ApiClient, body: CorrectionBody) => {
    const current = asked.current;
    if (!current) return Promise.resolve(undefined);
    return sendAdminParticipantChange(client, current.change, challengeId, current.userId, body);
  };
  const words = (key: string) =>
    target ? t(`admin.participants.changes.${target.change}.${key}`, { name: target.name }) : '';

  return (
    <RecomputeFlow
      key={round}
      change={{ title: words('title') }}
      reasonTitle={words('reasonTitle')}
      confirmLabel={words('confirm')}
      variant={target?.change === 'exclude' ? 'danger' : 'default'}
      errorScope="admin.participants.errors"
      send={send}
      onDone={() => {
        // The change made, as `send` read it.
        setMade(asked.current);
        setTarget(null);
        asked.current = null;
        setOpen(null);
        setQ(undefined);
        setRound((value) => value + 1);
      }}
    >
      {({ showPreview, pending, error }) =>
        children(
          <ParticipantsCard
            challengeId={challengeId}
            timeZone={timeZone}
            open={open}
            onOpen={(next) => {
              setOpen(next);
              setMade(null);
            }}
            q={q}
            onSearch={setQ}
            made={made}
            pending={pending}
            // A refusal is shown by the button that asked for it, while it is in sight.
            refused={target && error ? { target, error } : null}
            onChange={(next) => {
              asked.current = next;
              setTarget(next);
              setMade(null);
              showPreview();
            }}
          />,
        )
      }
    </RecomputeFlow>
  );
}

interface CardProps {
  challengeId: string;
  timeZone: string;
  open: Open;
  onOpen: (open: Open) => void;
  q: string | undefined;
  onSearch: (q: string | undefined) => void;
  made: Target | null;
  pending: boolean;
  refused: { target: Target; error: string } | null;
  onChange: (target: Target) => void;
}

function ParticipantsCard(props: CardProps) {
  const { challengeId, timeZone, open, onOpen, made } = props;
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const [size, setSize] = usePageSize('adminParticipants');
  const participants = useParticipants(challengeId, size);
  useFetchAllPages(participants, size === 'all');
  const items = participants.data?.pages.flatMap((page) => page.items) ?? [];
  const adding = open?.kind === 'add';
  const outcome = useRef<HTMLParagraphElement>(null);

  // Back on the sheet after a change: the focus goes to what it says.
  useEffect(() => {
    if (made) outcome.current?.focus();
  }, [made]);

  const columns = [
    t('admin.participants.columns.participant'),
    t('admin.participants.columns.role'),
    t('admin.participants.columns.status'),
    t('admin.participants.columns.joinedAt'),
    t('admin.participants.columns.actions'),
  ];

  return (
    <div className="flex flex-col gap-3">
      <p
        ref={outcome}
        role="status"
        tabIndex={-1}
        className={
          made ? 'rounded-row bg-ok-bg px-4 py-3 font-semibold text-ok-fg outline-none' : 'sr-only'
        }
      >
        {made && t(`admin.participants.changes.${made.change}.made`, { name: made.name })}
      </p>
      <PagedPart
        title={t('admin.participants.title')}
        empty={t('admin.participants.empty')}
        list={participants}
        size={size}
        onSize={setSize}
        action={
          <button
            type="button"
            aria-expanded={adding}
            aria-controls="admin-participant-add"
            onClick={() => onOpen(adding ? null : { kind: 'add' })}
            className={BUTTON}
          >
            <UserPlus aria-hidden="true" size={18} />
            {t('admin.participants.add')}
          </button>
        }
        table={
          <AdminTable caption={t('admin.participants.title')} columns={columns}>
            {items.map((participant) => (
              <ParticipantRows
                key={participant.user_id}
                {...props}
                participant={participant}
                joined={challengeDay(participant.joined_at, timeZone, locale)}
                columns={columns.length}
              />
            ))}
          </AdminTable>
        }
        // Under the title once open, above the list: the empty list still offers it.
        intro={adding && <AddParticipant {...props} />}
      />
    </div>
  );
}

/** A participant, and the row of their changes once opened. */
function ParticipantRows({
  participant,
  joined,
  columns,
  open,
  onOpen,
  pending,
  refused,
  onChange,
}: CardProps & { participant: Participant; joined: string; columns: number }) {
  const { t } = useTranslation();
  const abandoned = participant.status === 'abandoned';
  const name = displayName(participant) ?? t('admin.challenges.unnamed');
  const expanded = open?.kind === 'participant' && open.userId === participant.user_id;
  const rowId = `admin-participant-${participant.user_id}`;
  const error =
    refused && refused.target.userId === participant.user_id && refused.target.change !== 'add'
      ? refused.error
      : undefined;
  const changes = participantChanges(participant);
  // What leaving or coming back does: the change of the participation.
  const [participation] = changes;
  return (
    <>
      <tr className={abandoned ? 'text-muted' : undefined}>
        <th scope="row" className={`${CELL} font-semibold`}>
          <span className="flex min-h-11 items-center gap-3">
            <Avatar userId={participant.user_id} user={participant} muted={abandoned} />
            <span className="break-words">{name}</span>
          </span>
        </th>
        <td className={`${CELL} whitespace-nowrap`}>
          <span className="flex min-h-11 items-center gap-1.5">
            {participant.is_creator && (
              <Crown aria-hidden="true" size={16} className="flex-none text-accent" />
            )}
            {t(`admin.participants.roles.${participant.is_creator ? 'creator' : 'participant'}`)}
          </span>
        </td>
        <td className={CELL}>
          <span className="flex min-h-11 items-center">
            <StatusPill
              label={t(`admin.participants.status.${participant.status}`)}
              Icon={abandoned ? Flag : UserCheck}
              tone={abandoned ? 'neutral' : 'ok'}
            />
          </span>
        </td>
        <td className={`${CELL} whitespace-nowrap`}>
          <span className="flex min-h-11 items-center">{joined}</span>
        </td>
        <td className={CELL}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={rowId}
            aria-label={t('admin.participants.menu', { name })}
            onClick={() =>
              onOpen(expanded ? null : { kind: 'participant', userId: participant.user_id })
            }
            className={`flex size-11 items-center justify-center rounded-full border bg-surface hover-fill ${
              expanded ? 'border-accent text-accent' : 'border-border'
            }`}
          >
            <Ellipsis aria-hidden="true" size={20} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr id={rowId}>
          <td colSpan={columns} className="border-t border-border bg-segment/50 px-4 py-3">
            <div
              role="group"
              aria-label={t('admin.participants.menu', { name })}
              className="flex flex-wrap gap-3"
            >
              {changes.map((change) => {
                const Icon = ICONS[change];
                return (
                  <button
                    key={change}
                    type="button"
                    aria-disabled={pending}
                    onClick={() => {
                      if (!pending) onChange({ change, userId: participant.user_id, name });
                    }}
                    className={`${BUTTON} aria-disabled:opacity-60 ${change === 'exclude' ? 'text-danger' : ''}`}
                  >
                    <Icon aria-hidden="true" size={18} />
                    {t(`admin.participants.changes.${change}.button`)}
                  </button>
                );
              })}
              <Link to={`/admin/users/${participant.user_id}`} className={BUTTON}>
                <User aria-hidden="true" size={18} />
                {t('admin.participants.account')}
              </Link>
            </div>
            <p className="mt-2 text-sm text-muted">
              {t(
                // An excluded creator keeps the role: the admin removes it apart.
                `admin.participants.help.${
                  participation === 'exclude' && participant.is_creator
                    ? 'excludeCreator'
                    : participation
                }`,
              )}
            </p>
            {error && (
              <p role="alert" className={`mt-2 ${ERROR}`}>
                {error}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * The search of an account to add (pseudo, names or e-mail, sent in the body
 * of a POST), then the accounts found, each added through the preview.
 */
function AddParticipant({ q, onSearch, onOpen, pending, refused, onChange }: CardProps) {
  const { t } = useTranslation();
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    onSearch(typeof value === 'string' ? value.trim() || undefined : undefined);
  };
  const error = refused?.target.change === 'add' ? refused : null;
  return (
    <section
      id="admin-participant-add"
      aria-labelledby="admin-participant-add-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 id="admin-participant-add-title" className="font-bold">
          {t('admin.participants.add')}
        </h4>
        <button
          type="button"
          onClick={() => onOpen(null)}
          aria-label={t('admin.participants.search.close')}
          className="flex size-11 items-center justify-center rounded-full hover-fill"
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <form role="search" onSubmit={search} className="flex gap-2">
        <label htmlFor="admin-participant-search" className="sr-only">
          {t('admin.participants.search.label')}
        </label>
        <input
          id="admin-participant-search"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={MAX_USER_SEARCH_LENGTH}
          autoComplete="off"
          // Opened to type in it.
          autoFocus
          placeholder={t('admin.users.search.placeholder')}
          className="h-11 min-w-0 flex-1 rounded-row border border-border bg-surface px-4"
        />
        <button
          type="submit"
          className="flex h-11 items-center gap-2 rounded-full bg-accent hover-accent px-5 font-bold text-on-accent"
        >
          <Search aria-hidden="true" size={18} />
          {t('admin.users.search.submit')}
        </button>
      </form>
      {q ? (
        <FoundAccounts
          q={q}
          pending={pending}
          refused={error}
          onAdd={(userId, name) => onChange({ change: 'add', userId, name })}
        />
      ) : (
        <p className="text-sm text-muted">{t('admin.participants.search.hint')}</p>
      )}
    </section>
  );
}

/** The accounts the search finds, ten by ten, each with its button. */
function FoundAccounts({
  q,
  pending,
  refused,
  onAdd,
}: {
  q: string;
  pending: boolean;
  refused: { target: Target; error: string } | null;
  onAdd: (userId: string, name: string) => void;
}) {
  const { t } = useTranslation();
  const users = useAdminUsers(q, '10');
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];
  if (users.isPending) return <LoadingState />;
  if (!users.data) {
    return <ErrorState error={users.error} onRetry={() => void users.refetch()} />;
  }
  if (items.length === 0) return <EmptyState message={t('admin.users.empty.search')} />;
  return (
    <>
      <ul aria-label={t('admin.participants.search.found')} className="flex flex-col">
        {items.map((user) => {
          const name = displayName(user) ?? t('admin.users.noName');
          const error = refused?.target.userId === user.id ? refused.error : undefined;
          return (
            <li key={user.id} className="border-t border-border py-2 first:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{name}</p>
                  {user.email && <p className="text-sm break-all text-muted">{user.email}</p>}
                </div>
                <button
                  type="button"
                  aria-disabled={pending}
                  aria-label={t('admin.participants.search.chooseNamed', { name })}
                  onClick={() => {
                    if (!pending) onAdd(user.id, name);
                  }}
                  className={`${BUTTON} aria-disabled:opacity-60`}
                >
                  <UserPlus aria-hidden="true" size={18} />
                  {t('admin.participants.search.choose')}
                </button>
              </div>
              {error && (
                <p role="alert" className={`mt-1 ${ERROR}`}>
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <LoadMore
        hasMore={users.hasNextPage}
        loading={users.isFetchingNextPage}
        failed={users.isFetchNextPageError}
        onLoadMore={() => void users.fetchNextPage()}
      />
    </>
  );
}
