import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../../api/errors';
import { useAcceptInvitation, useOpenInvitation } from '../../api/hooks/useInvitations';
import { PageTitle } from '../../components/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { invitationTokenFromHash } from '../../domain/invitation';
import { HOME_PATH } from '../../lib/paths';

const isInvalid = (error: unknown) =>
  error instanceof ApiError && error.code === 'invitation_invalid';

/**
 * A refusal that trying again cannot change (closed, abandoned...), whose
 * code is translated; any other error offers a retry.
 */
const isRefusal = (error: ApiError, hasKey: (key: string) => boolean) =>
  [404, 409, 422].includes(error.status) && hasKey(`errors.${error.code}`);

const challengePath = (id: string) => `/challenges/${encodeURIComponent(id)}`;

/**
 * Invitation page (/invite#<token>), for a signed-in user with a complete
 * profile: the route above signs in and onboards first, then comes back
 * here. The token is read from the fragment and its shape checked before any
 * call. The user then joins the challenge at once and lands on its page
 * (decision of 2026-11-23, SC-WEB-107); a link that cannot be one, or a join
 * the server refuses, says so.
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

/** Why the challenge cannot be joined, and the way home. */
function Refused({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 rounded-card border border-border bg-surface p-5">
      <p role="alert">{message}</p>
      <Link
        to={HOME_PATH}
        // The refused link leaves the history.
        replace
        className="mt-4 inline-flex h-11 items-center rounded-full border border-border bg-surface hover-fill px-5 font-bold"
      >
        {t('notFound.backHome')}
      </Link>
    </div>
  );
}

function InvalidInvitation() {
  const { t } = useTranslation();
  return <Refused message={t('invitationPage.invalid')} />;
}

/** Opens the link, to know its challenge, then joins it. */
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
  return <JoinedInvitation token={token} challengeId={open.data.challenge_id} />;
}

/**
 * Joins the challenge of the invitation once, then opens its page in place
 * of the link (replace: the token leaves the history). A participant already
 * in it lands there too.
 */
function JoinedInvitation({ token, challengeId }: { token: string; challengeId: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const accept = useAcceptInvitation();
  const { mutate } = accept;
  // Sent once, even when development mounts the page twice.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    mutate(token);
  }, [mutate, token]);

  const joinedId = accept.data?.id;
  const code = accept.error instanceof ApiError ? accept.error.code : undefined;
  const already = code === 'already_participant';
  useEffect(() => {
    if (joinedId) void navigate(challengePath(joinedId), { replace: true });
    else if (already) void navigate(challengePath(challengeId), { replace: true });
  }, [joinedId, already, challengeId, navigate]);

  // On the way: to the challenge, or to onboarding (the profile reloads).
  if (already || code === 'profile_incomplete') return <Loading />;
  if (isInvalid(accept.error)) return <InvalidInvitation />;
  if (accept.error instanceof ApiError && isRefusal(accept.error, (key) => i18n.exists(key))) {
    const { key, values } = errorMessage(accept.error, (candidate) => i18n.exists(candidate));
    return <Refused message={t(key, values)} />;
  }
  if (accept.isError) {
    return (
      <div className="mt-6">
        <ErrorState error={accept.error} onRetry={() => mutate(token)} />
      </div>
    );
  }
  return <Loading />;
}
