import { ChevronRight, Flag, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useChallenge, useParticipants, type Participant } from '../../../api/hooks/useChallenges';
import { Avatar } from '../../../components/Avatar';
import { LoadMore } from '../../../components/LoadMore';
import { StatusPill } from '../../../components/StatusPill';
import { EmptyState } from '../../../components/states/EmptyState';
import { ErrorState } from '../../../components/states/ErrorState';
import { LoadingState } from '../../../components/states/LoadingState';
import { canSeeParticipantActivities } from '../../../domain/challenge';
import { displayName } from '../../../domain/displayName';
import { challengeDay } from '../../../domain/format/challengeDates';

const ROW = 'flex min-h-14 items-center gap-3 rounded-row border px-3 py-2';
const ROW_ACTIVE = 'border-border bg-surface';
// Out of the challenge: dashed and muted, like an eliminated participant (design.md).
const ROW_ABANDONED = 'border-dashed border-border-dashed text-muted';

/**
 * Participants tab of a challenge, in order of registration, page by page:
 * avatar, name, status and day of registration (in the challenge's time
 * zone). Those who may see the activities of the others (creators and
 * participants) open them from a row. Rendered under the challenge page,
 * which has already loaded the challenge.
 */
export function ChallengeParticipants() {
  const { challengeId = '' } = useParams();
  const { t } = useTranslation();
  const challenge = useChallenge(challengeId);
  const participants = useParticipants(challengeId);

  if (!challenge.data) return null;
  if (participants.isPending) return <LoadingState />;
  // Nothing loaded: the whole list failed (a failed "load more" keeps it).
  if (!participants.data) {
    return <ErrorState error={participants.error} onRetry={() => void participants.refetch()} />;
  }
  const items = participants.data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <EmptyState message={t('challengeDetail.participants.empty')} />;

  const linked = canSeeParticipantActivities(challenge.data.my_role);
  return (
    <section aria-label={t('challengeDetail.participants.label')}>
      <ul className="grid grid-cols-1 gap-2">
        {items.map((participant) => {
          const row = `${ROW} ${participant.status === 'abandoned' ? ROW_ABANDONED : ROW_ACTIVE}`;
          const content = (
            <ParticipantRow participant={participant} timeZone={challenge.data.timezone} />
          );
          return (
            <li key={participant.user_id}>
              {linked ? (
                <Link
                  to={`/challenges/${challengeId}/participants/${participant.user_id}`}
                  className={row}
                >
                  {content}
                  <ChevronRight aria-hidden="true" size={20} className="shrink-0 text-muted" />
                </Link>
              ) : (
                <div className={row}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      <LoadMore
        hasMore={participants.hasNextPage}
        loading={participants.isFetchingNextPage}
        failed={participants.isFetchNextPageError}
        onLoadMore={() => void participants.fetchNextPage()}
      />
    </section>
  );
}

function ParticipantRow({ participant, timeZone }: { participant: Participant; timeZone: string }) {
  const { t, i18n } = useTranslation();
  const abandoned = participant.status === 'abandoned';
  const name = displayName(participant) ?? t('challengeDetail.participants.unnamed');
  return (
    <>
      <Avatar userId={participant.user_id} user={participant} muted={abandoned} />
      {/* The pill sits beside the name, under it when the text is enlarged. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-20">
          {/* A long name is cut: the title keeps it whole. */}
          <p className="truncate font-semibold" title={name}>
            {name}
          </p>
          <p className="text-sm text-muted">
            {t('challengeDetail.participants.joined', {
              date: challengeDay(participant.joined_at, timeZone, i18n.resolvedLanguage ?? 'fr'),
            })}
          </p>
        </div>
        <StatusPill
          label={t(`challengeDetail.participants.status.${participant.status}`)}
          Icon={abandoned ? Flag : UserCheck}
          tone={abandoned ? 'out' : 'neutral'}
        />
      </div>
    </>
  );
}
