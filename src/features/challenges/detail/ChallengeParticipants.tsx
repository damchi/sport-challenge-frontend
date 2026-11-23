import { ChevronRight, Crown, Flag, UserCheck } from 'lucide-react';
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
import {
  CreatorActionDialog,
  CreatorActionOutcome,
  ParticipantActions,
} from './ParticipantActions';
import { useCreatorActions } from './useCreatorActions';

const ROW = 'rounded-row border';
// Rounded too: the focus ring follows the row.
const ROW_CONTENT = 'flex min-h-14 items-center gap-3 rounded-row px-3 py-2';
const ROW_LINK = `${ROW_CONTENT} hover-fill`;
const ROW_ACTIVE = 'border-border bg-surface';
// Out of the challenge: dashed and muted, like an eliminated participant (design.md).
const ROW_ABANDONED = 'border-dashed border-border-dashed text-muted';

/**
 * Participants of a challenge (its tab, or the card of an upcoming one), in
 * order of registration, page by page:
 * avatar, name, creator role, status and day of registration (in the
 * challenge's time zone). Those who may see the activities of the others
 * (creators and participants) open them from a row, once it has started. The creators of a
 * challenge not finished (the server's role and status) can make an active
 * participant a creator, or exclude them, after a confirmation; a creator is
 * never offered either. Rendered under the challenge page, which has already
 * loaded the challenge.
 */
export function ChallengeParticipants() {
  const { challengeId = '' } = useParams();
  const { t } = useTranslation();
  const challenge = useChallenge(challengeId);
  const participants = useParticipants(challengeId);
  const actions = useCreatorActions(challengeId);

  if (!challenge.data) return null;
  if (participants.isPending) return <LoadingState />;
  // Nothing loaded: the whole list failed (a failed "load more" keeps it).
  if (!participants.data) {
    return <ErrorState error={participants.error} onRetry={() => void participants.refetch()} />;
  }
  const items = participants.data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <EmptyState message={t('challengeDetail.participants.empty')} />;

  // Before the start, no one has activities to open yet.
  const linked =
    canSeeParticipantActivities(challenge.data.my_role) && challenge.data.status !== 'upcoming';
  // The server refuses both on a finished challenge (challenge_ended).
  const manages = challenge.data.my_role === 'creator' && challenge.data.status !== 'finished';
  return (
    <section aria-label={t('challengeDetail.participants.label')}>
      <CreatorActionOutcome actions={actions} />
      <ul className="grid grid-cols-1 gap-2">
        {items.map((participant) => {
          const row = `${ROW} ${participant.status === 'abandoned' ? ROW_ABANDONED : ROW_ACTIVE}`;
          const content = (
            <ParticipantRow participant={participant} timeZone={challenge.data.timezone} />
          );
          return (
            <li key={participant.user_id} className={row}>
              {linked ? (
                <Link
                  to={`/challenges/${challengeId}/participants/${participant.user_id}`}
                  className={ROW_LINK}
                >
                  {content}
                  <ChevronRight aria-hidden="true" size={20} className="shrink-0 text-muted" />
                </Link>
              ) : (
                <div className={ROW_CONTENT}>{content}</div>
              )}
              {manages && participant.status === 'active' && !participant.is_creator && (
                <ParticipantActions participant={participant} actions={actions} />
              )}
            </li>
          );
        })}
      </ul>
      <CreatorActionDialog actions={actions} />
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
        <div className="flex flex-wrap gap-1">
          {participant.is_creator && (
            <StatusPill label={t('challenges.role.creator')} Icon={Crown} tone="neutral" />
          )}
          <StatusPill
            label={t(`challengeDetail.participants.status.${participant.status}`)}
            Icon={abandoned ? Flag : UserCheck}
            tone={abandoned ? 'out' : 'neutral'}
          />
        </div>
      </div>
    </>
  );
}
