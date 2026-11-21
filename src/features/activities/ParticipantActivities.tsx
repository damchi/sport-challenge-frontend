import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/errors';
import { useParticipantActivities } from '../../api/hooks/useActivities';
import { useChallenge } from '../../api/hooks/useChallenges';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { canSeeParticipantActivities, isUserId } from '../../domain/challenge';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { ActivityCard } from './ActivityCard';

/**
 * Activities of a participant in a challenge, read only, most recent first,
 * page by page, their starts in the challenge's time zone (named when it is
 * not the device's). Neither an id that cannot be one nor a user whose role
 * keeps them out (the API would answer 404) is sent to the API. Rendered
 * under the challenge page, which has already loaded the challenge.
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

  if (activities.isPending) return <LoadingState />;
  // Not a participant, or not one the user may see: the API answers the same
  // 404, and so does the page, even when a refresh finds it so after a first load.
  if (activities.error instanceof ApiError && activities.error.status === 404) {
    return <ParticipantActivitiesNotFound challengeId={challengeId} />;
  }
  // Nothing loaded: the whole list failed (a failed "load more" keeps it).
  if (!activities.data) {
    return <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />;
  }

  const items = activities.data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <EmptyState message={t('participantActivities.empty')} />;

  const zone = otherTimeZoneName(
    timeZone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    i18n.resolvedLanguage ?? 'fr',
  );
  return (
    <section aria-label={t('participantActivities.label')}>
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
