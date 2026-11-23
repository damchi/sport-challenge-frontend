import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ApiError } from '../../api/errors';
import { useChallengeActivities } from '../../api/hooks/useActivities';
import { useChallenge } from '../../api/hooks/useChallenges';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import { LoadMore } from '../../components/LoadMore';
import { PageSizeChoice } from '../../components/PageSizeChoice';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { canSeeParticipantActivities } from '../../domain/challenge';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { usePageSize } from '../../lib/pageSize';
import { ActivityCard } from './ActivityCard';

/**
 * The Activities section of a challenge: every participant's activities
 * (abandoned ones included), each with its author, in the server's order
 * (most recent first), 10, 50 or all of them (kept on the device), page by
 * page, their starts in the challenge's time zone (named when it is not the
 * device's). Nothing in it is a link (decision of 2026-11-21). A role that keeps the user out (the API would
 * answer 404) sends nothing. Rendered under the challenge page, which has
 * already loaded the challenge.
 */
export function ChallengeActivities() {
  const { challengeId = '' } = useParams();
  const challenge = useChallenge(challengeId);
  if (!challenge.data) return null;
  if (!canSeeParticipantActivities(challenge.data.my_role)) return <ChallengeActivitiesNotFound />;
  return <ChallengeActivitiesContent challengeId={challengeId} timeZone={challenge.data.timezone} />;
}

function ChallengeActivitiesContent({
  challengeId,
  timeZone,
}: {
  challengeId: string;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation();
  const [size, setSize] = usePageSize('challengeActivities');
  const activities = useChallengeActivities(challengeId, size);
  useFetchAllPages(activities, size === 'all');

  // Never joined, or no longer visible: the API answers the same 404, and so
  // does the section, even when a refresh finds it so after a first load.
  if (activities.error instanceof ApiError && activities.error.status === 404) {
    return <ChallengeActivitiesNotFound />;
  }
  const items = activities.data?.pages.flatMap((page) => page.items);
  if (items?.length === 0) return <EmptyState message={t('challengeActivities.empty')} />;

  const zone = otherTimeZoneName(
    timeZone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    i18n.resolvedLanguage ?? 'fr',
  );
  return (
    <section aria-label={t('challengeActivities.label')}>
      {/* Kept while the list reloads in its new size (the focus stays on it);
          hidden when the list failed. */}
      {(items || activities.isPending) && (
        <div className="mb-4">
          <PageSizeChoice size={size} onChange={setSize} />
        </div>
      )}
      {activities.isPending ? (
        <LoadingState />
      ) : !items ? (
        // Nothing loaded: the whole list failed (a failed "load more" keeps it).
        <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />
      ) : (
        <>
          {zone && <p className="mb-3 text-sm text-muted">{t('activities.timeZone', { zone })}</p>}
          <ul className="grid grid-cols-1 gap-3">
            {items.map(({ user, ...activity }) => (
              <li key={activity.id}>
                <ActivityCard activity={activity} timeZone={timeZone} author={user} />
              </li>
            ))}
          </ul>
          <LoadMore
            hasMore={activities.hasNextPage}
            loading={activities.isFetchingNextPage}
            // While every page is read, a failed reload also stops the reading.
            failed={activities.isFetchNextPageError || (size === 'all' && activities.isError)}
            auto={size === 'all'}
            onLoadMore={() => void activities.fetchNextPage()}
          />
        </>
      )}
    </section>
  );
}

/** The same words whatever keeps the user out: the section never tells which. */
function ChallengeActivitiesNotFound() {
  const { t } = useTranslation();
  return <EmptyState message={t('challengeActivities.notFound')} />;
}
