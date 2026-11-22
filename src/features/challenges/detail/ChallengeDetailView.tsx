import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useParams } from 'react-router';
import { ApiError } from '../../../api/errors';
import { useChallenge } from '../../../api/hooks/useChallenges';
import { ErrorState } from '../../../components/states/ErrorState';
import { LoadingState } from '../../../components/states/LoadingState';
import { isChallengeId } from '../../../domain/challenge';
import { isWithin, usePendingPath } from '../../../lib/pendingNavigation';
import { ChallengeInvite } from '../../invitations/ChallengeInvite';
import { ChallengeWeekBanner } from '../../leaderboard/ChallengeWeekBanner';
import { MyStandings } from '../../leaderboard/MyStandings';
import { ChallengeDelete } from './ChallengeDelete';
import { ChallengeEdit } from './ChallengeEdit';
import { ChallengeHeader } from './ChallengeHeader';
import { ChallengeMenu, type MenuAction } from './ChallengeMenu';
import { ChallengeNotFound } from './ChallengeNotFound';
import { ChallengeParticipation } from './ChallengeParticipation';
import { ChallengeRules } from './ChallengeRules';
import { ChallengeTabs } from './ChallengeTabs';

/**
 * Page of a challenge: its header (invite, menu of the role's actions), where
 * it stands in time, « Où tu en es », its sections (nested routes) and the
 * rules of its categories. An id that cannot be one is not sent to the API.
 */
export function ChallengeDetailView() {
  const { challengeId } = useParams();
  if (!isChallengeId(challengeId)) return <ChallengeNotFound />;
  return <ChallengeDetailContent challengeId={challengeId} />;
}

function ChallengeDetailContent({ challengeId }: { challengeId: string }) {
  const { t } = useTranslation();
  const challenge = useChallenge(challengeId);
  // A section of this challenge whose code still loads.
  const pending = usePendingPath();
  const sectionLoading = pending !== undefined && isWithin(pending, `/challenges/${challengeId}`);
  // The action chosen in the header's menu; once done, the focus goes back
  // to the menu's button.
  const [action, setAction] = useState<MenuAction | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeAction = () => {
    setAction(null);
    menuButton.current?.focus();
  };

  if (challenge.isPending) {
    return (
      <>
        <h1 className="sr-only">{t('challengeDetail.title')}</h1>
        <LoadingState />
      </>
    );
  }
  // Missing, deleted or hidden: the API answers the same 404, and so does the
  // page, even when a refresh finds it gone after a first load.
  if (challenge.error instanceof ApiError && challenge.error.status === 404) {
    return <ChallengeNotFound />;
  }
  if (!challenge.data) {
    return (
      <>
        <h1 className="sr-only">{t('challengeDetail.title')}</h1>
        <ErrorState error={challenge.error} onRetry={() => void challenge.refetch()} />
      </>
    );
  }

  return (
    <>
      <ChallengeHeader
        challenge={challenge.data}
        actions={
          <>
            <ChallengeInvite challenge={challenge.data} />
            <ChallengeMenu challenge={challenge.data} buttonRef={menuButton} onSelect={setAction} />
          </>
        }
      />
      <ChallengeEdit challenge={challenge.data} open={action === 'edit'} onClose={closeAction} />
      <ChallengeDelete
        challenge={challenge.data}
        open={action === 'delete'}
        onClose={closeAction}
      />
      <ChallengeParticipation
        challenge={challenge.data}
        abandoning={action === 'abandon'}
        onAbandonClose={closeAction}
      />
      <ChallengeWeekBanner challenge={challenge.data} />
      <MyStandings challenge={challenge.data} />
      <div className="mt-6 flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_560px]">
          <ChallengeTabs challengeId={challengeId} />
          <div className="mt-4">{sectionLoading ? <LoadingState /> : <Outlet />}</div>
        </div>
        <ChallengeRules challenge={challenge.data} className="flex-[1_1_300px]" />
      </div>
    </>
  );
}
