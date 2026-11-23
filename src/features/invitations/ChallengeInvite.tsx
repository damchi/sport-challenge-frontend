import { Copy, Share2, UserPlus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import type { ChallengeDetail } from '../../api/hooks/useChallenges';
import { useCreateInvitation } from '../../api/hooks/useInvitations';
import { challengeInstant, otherTimeZoneName } from '../../domain/format/challengeDates';
import { canInvite, invitationLink } from '../../domain/invitation';
import { inputClass } from '../challenges/create/fields';

type Notice = 'copied' | 'copyFailed' | 'shareFailed';

const BUTTON_BASE =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold aria-disabled:opacity-60';
const BUTTON = `${BUTTON_BASE} border border-border bg-surface hover-fill`;
const BUTTON_PRIMARY = `${BUTTON_BASE} bg-accent text-on-accent hover-accent`;

/**
 * Invitation to a challenge, for those who may invite (canInvite). The button
 * creates a link, valid until the end of week 1: the user copies it, or
 * shares it with the system's share sheet where the browser has one. When
 * the copy fails, the link is selected for a copy by hand. Made for the
 * header's grid: the button is a cell (round, its icon alone, on a phone),
 * the link a row of its own below. Tests give `now`.
 */
export function ChallengeInvite({
  challenge,
  now: givenNow,
  primary = false,
}: {
  challenge: ChallengeDetail;
  now?: Date;
  /** The page's main action (before the start): the accent button. */
  primary?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [now] = useState(() => givenNow ?? new Date());
  const create = useCreateInvitation(challenge.id);
  const [notice, setNotice] = useState<Notice | null>(null);
  const linkField = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const linkId = useId();
  const created = create.data;

  // Once created, the focus goes to the link, which is read with its label.
  useEffect(() => {
    if (created) linkField.current?.focus();
  }, [created]);

  if (!canInvite(challenge, now)) return null;

  const error = create.error;
  const errorKey =
    error instanceof ApiError && error.code === 'forbidden'
      ? { key: 'invitations.forbidden', values: {} }
      : error instanceof ApiError
        ? errorMessage(error, (candidate) => i18n.exists(candidate))
        : error
          ? { key: 'errors.unknown', values: {} }
          : undefined;

  if (!created) {
    return (
      <div>
        <button
          type="button"
          // Not `disabled`: a disabled button would drop the focus while sending.
          aria-disabled={create.isPending}
          onClick={() => {
            if (!create.isPending) create.mutate();
          }}
          className={`${primary ? BUTTON_PRIMARY : BUTTON} w-11 px-0 md:w-auto md:px-4`}
        >
          <UserPlus aria-hidden="true" size={20} strokeWidth={2} />
          <span className="sr-only md:not-sr-only">
            {create.isPending ? t('invitations.busy') : t('invitations.button')}
          </span>
        </button>
        {errorKey && (
          <p role="alert" className="mt-2 max-w-48 text-sm font-semibold md:max-w-xs">
            {t(errorKey.key, errorKey.values)}
          </p>
        )}
      </div>
    );
  }

  const locale = i18n.resolvedLanguage ?? 'fr';
  const zone = otherTimeZoneName(
    challenge.timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );
  const link = invitationLink(window.location.origin, created.token);
  const canShare = typeof navigator.share === 'function';

  const selectLink = () => {
    linkField.current?.focus();
    linkField.current?.select();
  };
  const copy = async () => {
    // Emptied first, so that a second copy is announced again.
    setNotice(null);
    try {
      await navigator.clipboard.writeText(link);
      setNotice('copied');
    } catch {
      // No clipboard (insecure page, refused permission): copied by hand.
      selectLink();
      setNotice('copyFailed');
    }
  };
  const share = async () => {
    setNotice(null);
    try {
      await navigator.share({
        title: challenge.title,
        text: t('invitations.shareText', { title: challenge.title }),
        url: link,
      });
    } catch (shareError) {
      // Closing the share sheet is not a failure.
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setNotice('shareFailed');
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="col-span-full rounded-card border border-border bg-surface p-4"
    >
      <h2 id={headingId} className="font-display text-lg font-bold">
        {t('invitations.heading')}
      </h2>
      <label htmlFor={linkId} className="mt-3 block text-sm font-semibold">
        {t('invitations.link')}
      </label>
      <input
        ref={linkField}
        id={linkId}
        type="url"
        readOnly
        value={link}
        onFocus={(event) => event.currentTarget.select()}
        className={`${inputClass} h-11 w-full`}
      />
      <p className="mt-2 text-sm text-muted">
        {t('invitations.expires', {
          date: challengeInstant(created.expires_at, challenge.timezone, locale),
          zone,
          context: zone && 'zone',
        })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className={BUTTON}>
          <Copy aria-hidden="true" size={20} strokeWidth={2} />
          {t('invitations.copy')}
        </button>
        {canShare && (
          <button type="button" onClick={() => void share()} className={BUTTON}>
            <Share2 aria-hidden="true" size={20} strokeWidth={2} />
            {t('invitations.share')}
          </button>
        )}
      </div>
      <p role="status" className="mt-2 text-sm">
        {notice && t(`invitations.${notice}`)}
      </p>
    </section>
  );
}
