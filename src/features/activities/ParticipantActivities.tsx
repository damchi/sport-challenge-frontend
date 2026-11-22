import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/errors';
import { useParticipantActivities } from '../../api/hooks/useActivities';
import { useChallenge, useLeaderboard } from '../../api/hooks/useChallenges';
import { useMe } from '../../api/hooks/useMe';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { canSeeParticipantActivities, isUserId } from '../../domain/challenge';
import { displayName } from '../../domain/displayName';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { ActivityCard } from './ActivityCard';

/**
 * Activities of a participant in a challenge, read only, most recent first,
 * page by page, their starts in the challenge's time zone (named when it is
 * not the device's). Neither an id that cannot be one nor a user whose role
 * keeps them out (the API would answer 404) is sent to the API. Titled with
 * the participant's name, read from the leaderboard (every participant is in
 * it; the activities route gives no name), with a way back to the
 * participants. Rendered under the challenge page, which has already loaded
 * the challenge.
 */
export function ParticipantActivities() {
  const { challengeId = '', userId } = useParams();
  const challenge = useChallenge(challengeId);
  if (!challenge.data) return null;
  if (!isUserId(userId) || !canSeeParticipantActivities(challenge.data.my_role)) {
    return <ParticipantActivitiesNotFound challengeId={challengeId} />;
  }
  return (
    <ParticipantActivitiesContent
      challengeId={challengeId}
      userId={userId}
      timeZone={challenge.data.timezone}
    />
  );
}

/**
 * The way back to the participants, then the title: "Tes activités" for the
 * user, "Activités de marie_92" for another, a neutral one while the name is
 * not known (leaderboard loading, or not in it).
 */
function ParticipantHeading({ challengeId, userId }: { challengeId: string; userId: string }) {
  const { t } = useTranslation();
  const leaderboard = useLeaderboard(challengeId);
  const me = useMe();
  const user = leaderboard.data?.categories[0]?.entries.find(
    (entry) => entry.user.id === userId,
  )?.user;
  let title: ReactNode = t('participantActivities.label');
  if (userId === me.data?.id) title = t('participantActivities.mine');
  else if (user) {
    title = t('participantActivities.title', {
      name: displayName(user) ?? t('challengeDetail.participants.unnamed'),
    });
  }
  return (
    <div className="mb-4">
      <Link
        to={`/challenges/${challengeId}/participants`}
        className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted"
      >
        <ChevronLeft aria-hidden="true" size={18} strokeWidth={2} />
        {t('participantActivities.toParticipants')}
      </Link>
      <h2 className="font-display text-lg font-bold break-words">{title}</h2>
    </div>
  );
}

function ParticipantActivitiesContent({
  challengeId,
  userId,
  timeZone,
}: {
  challengeId: string;
  userId: string;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation();
  const activities = useParticipantActivities(challengeId, userId);

  // Not found: the page says so with its own way back, untitled.
  const heading = <ParticipantHeading challengeId={challengeId} userId={userId} />;
  if (activities.isPending) {
    return (
      <>
        {heading}
        <LoadingState />
      </>
    );
  }
  // Not a participant, or not one the user may see: the API answers the same
  // 404, and so does the page, even when a refresh finds it so after a first load.
  if (activities.error instanceof ApiError && activities.error.status === 404) {
    return <ParticipantActivitiesNotFound challengeId={challengeId} />;
  }
  // Nothing loaded: the whole list failed (a failed "load more" keeps it).
  if (!activities.data) {
    return (
      <>
        {heading}
        <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />
      </>
    );
  }

  const items = activities.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <>
        {heading}
        <EmptyState message={t('participantActivities.empty')} />
      </>
    );
  }

  const zone = otherTimeZoneName(
    timeZone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    i18n.resolvedLanguage ?? 'fr',
  );
  return (
    <section aria-label={t('participantActivities.label')}>
      {heading}
      {zone && <p className="mb-3 text-sm text-muted">{t('activities.timeZone', { zone })}</p>}
      <ul className="grid grid-cols-1 gap-3">
        {items.map((activity) => (
          <li key={activity.id}>
            <ActivityCard activity={activity} timeZone={timeZone} />
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={activities.hasNextPage}
        loading={activities.isFetchingNextPage}
        failed={activities.isFetchNextPageError}
        onLoadMore={() => void activities.fetchNextPage()}
      />
    </section>
  );
}

/**
 * No activities to show. The same words whether the user may not see them
 * or the participant never joined: the page never tells which.
 */
function ParticipantActivitiesNotFound({ challengeId }: { challengeId: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      message={t('participantActivities.notFound')}
      action={
        <Link
          to={`/challenges/${challengeId}/participants`}
          className="inline-flex h-11 items-center font-bold text-accent underline underline-offset-4"
        >
          {t('participantActivities.toParticipants')}
        </Link>
      }
    />
  );
}
