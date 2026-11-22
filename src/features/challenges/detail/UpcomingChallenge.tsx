import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { ChallengeDetails } from './ChallengeDetails';
import { ChallengeParticipants } from './ChallengeParticipants';
import { HowToWin } from './HowToWin';

const CARD = 'rounded-card border border-border bg-surface p-4 lg:p-5';

/**
 * Body of the page of an upcoming challenge, without tabs (nothing is ranked
 * before the start): its participants (registered ones: invitations are
 * links), how each of its categories is won, its details, and for its
 * creators a reminder of what they can still change (`onEdit` opens it).
 */
export function UpcomingChallenge({
  challenge,
  onEdit,
}: {
  challenge: ChallengeDetail;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
        <section aria-labelledby="upcoming-participants" className={CARD}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 id="upcoming-participants" className="font-display text-lg font-bold">
              {t('challengeDetail.tabs.participants')}
            </h2>
            <p className="text-sm text-muted">
              {t('challenges.participants', { count: challenge.participant_count })}
            </p>
          </div>
          <ChallengeParticipants />
        </section>
        <HowToWin challenge={challenge} />
      </div>
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
        <ChallengeDetails challenge={challenge} />
        {challenge.my_role === 'creator' && (
          <section
            aria-labelledby="upcoming-creator"
            className="rounded-card border border-dashed border-border-dashed p-4 lg:p-5"
          >
            <h2 id="upcoming-creator" className="font-bold">
              {t('challengeDetail.upcoming.creator.title')}
            </h2>
            <p className="mt-1 text-sm text-muted">{t('challengeDetail.upcoming.creator.text')}</p>
            <button
              type="button"
              onClick={onEdit}
              className="-mx-1 mt-2 min-h-11 px-1 font-bold text-accent underline underline-offset-4"
            >
              {t('challengeDetail.upcoming.creator.edit')}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
