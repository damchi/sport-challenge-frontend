import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../../api/errors';
import { useChallenge, type ChallengeDetail } from '../../api/hooks/useChallenges';
import { useAcceptInvitation, useOpenInvitation } from '../../api/hooks/useInvitations';
import { PageTitle } from '../../components/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { invitationTokenFromHash } from '../../domain/invitation';
import { challengePeriod } from '../../domain/format/challengeDates';
import { useJoinCopy } from '../challenges/detail/useJoinCopy';

const isInvalid = (error: unknown) =>
  error instanceof ApiError && error.code === 'invitation_invalid';

/**
 * Invitation page (/invite#<token>), for a signed-in user with a complete
 * profile: the route above signs in and onboards first, then comes back
 * here. The token is read from the fragment and its shape checked before any
 * call; a link that cannot be one, or that the server refuses, says so.
 */
export function InvitationView() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const token = invitationTokenFromHash(hash);
  return (
    <>
      <PageTitle>{t('invitationPage.title')}</PageTitle>
      {token ? <OpenedInvitation token={token} /> : <InvalidInvitation />}
    </>
  );
}

function Loading() {
  return (
    <div className="mt-6">
      <LoadingState />
    </div>
  );
}

function InvalidInvitation() {
  const { t } = useTranslation();
  return (
    <div className="mt-6 rounded-card border border-border bg-surface p-5">
      <p role="alert">{t('invitationPage.invalid')}</p>
      <Link
        to="/"
        // The refused link leaves the history.
        replace
        className="mt-4 inline-flex h-11 items-center rounded-full border border-border bg-surface hover-fill px-5 font-bold"
      >
        {t('notFound.backHome')}
      </Link>
    </div>
  );
}

/** Opens the link (which makes the user invited), then shows its challenge. */
function OpenedInvitation({ token }: { token: string }) {
  const open = useOpenInvitation(token);
  if (open.isPending) return <Loading />;
  if (isInvalid(open.error)) return <InvalidInvitation />;
  if (!open.data) {
    return (
      <div className="mt-6">
        <ErrorState error={open.error} onRetry={() => void open.refetch()} />
      </div>
    );
  }
  return <InvitationPreview token={token} challengeId={open.data.challenge_id} />;
}

/**
 * The challenge of the invitation: title, dates in its time zone (named when
 * the user's differs), participants, and that the activities will be seen by
 * the other participants. Accepting, as the server allows joining (can_join),
 * is the confirmation: nothing is joined before. Otherwise, why not.
 */
function InvitationPreview({ token, challengeId }: { token: string; challengeId: string }) {
  const challenge = useChallenge(challengeId);
  if (challenge.isPending) return <Loading />;
  if (!challenge.data) {
    return (
      <div className="mt-6">
        <ErrorState error={challenge.error} onRetry={() => void challenge.refetch()} />
      </div>
    );
  }
  return <InvitedChallenge token={token} challenge={challenge.data} />;
}

function InvitedChallenge({
  token,
  challenge: data,
}: {
  token: string;
  challenge: ChallengeDetail;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const accept = useAcceptInvitation(data.id);
  const { zone, deadline, reason } = useJoinCopy(data);
  // The reason of a refused accept takes the focus once: the button is gone.
  const focused = useRef(false);

  if (isInvalid(accept.error)) return <InvalidInvitation />;
  // Joined: the challenge's page opens.
  if (accept.isSuccess) return <Loading />;

  const locale = i18n.resolvedLanguage ?? 'fr';
  const acceptError =
    accept.error instanceof ApiError
      ? errorMessage(accept.error, (candidate) => i18n.exists(candidate))
      : accept.error
        ? { key: 'errors.unknown', values: {} }
        : undefined;

  return (
    <section
      aria-labelledby="invitation-challenge"
      className="mt-6 rounded-card border border-border bg-surface p-5"
    >
      <p className="text-sm text-muted">{t('invitationPage.intro')}</p>
      <h2 id="invitation-challenge" className="mt-1 font-display text-xl font-bold break-words">
        {data.title}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {t(
          'challenges.period',
          challengePeriod(data.starts_at, data.ends_at, data.timezone, locale),
        )}
      </p>
      {zone && <p className="mt-1 text-sm text-muted">{t('challengeDetail.timeZone', { zone })}</p>}
      <p className="mt-1 text-sm text-muted">
        {t('challenges.participants', { count: data.participant_count })}
      </p>

      {data.can_join ? (
        <>
          <p className="mt-4">{t('challengeDetail.registrationOpen', deadline)}</p>
          <p className="mt-2 font-semibold">{t('challengeDetail.join.message')}</p>
          {acceptError && (
            <p role="alert" className="mt-4 font-semibold">
              {t(acceptError.key, acceptError.values)}
            </p>
          )}
          <button
            type="button"
            aria-disabled={accept.isPending}
            onClick={() => {
              if (accept.isPending) return;
              accept.mutate(token, {
                // Replace: the link and its token leave the history.
                onSuccess: (joined) =>
                  void navigate(`/challenges/${encodeURIComponent(joined.id)}`, { replace: true }),
              });
            }}
            className="mt-4 h-13 w-full rounded-full bg-accent hover-accent px-6 text-button font-bold text-on-accent aria-disabled:opacity-60 md:w-auto"
          >
            {accept.isPending ? t('challengeDetail.join.busy') : t('invitationPage.accept')}
          </button>
        </>
      ) : (
        // A refused accept is said by the reloaded challenge's reason, mounted
        // anew (key) so that it is announced.
        <p
          key={accept.isError ? 'refused' : 'reason'}
          ref={(element) => {
            if (!element || !accept.isError || focused.current) return;
            focused.current = true;
            element.focus();
          }}
          tabIndex={accept.isError ? -1 : undefined}
          role={accept.isError ? 'alert' : undefined}
          className="mt-4"
        >
          {reason}
        </p>
      )}

      {/* A new history entry: back returns to the invitation, which can still
          be accepted, instead of the sign-in pages before it. */}
      <Link
        to={`/challenges/${encodeURIComponent(data.id)}`}
        className="mt-3 flex h-11 items-center justify-center rounded-full border border-border bg-surface hover-fill px-5 font-bold md:inline-flex"
      >
        {t('invitationPage.open')}
      </Link>
    </section>
  );
}
