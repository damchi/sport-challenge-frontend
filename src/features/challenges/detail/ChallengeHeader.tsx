import { Check, ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { PageTitle } from '../../../components/Page';
import { StatusPill } from '../../../components/StatusPill';

/**
 * Head of a challenge's page: the way back, the title, `actions` (invite,
 * menu) and a line of facts: participants, categories and, during the
 * weeks, the current one of how many (the server's numbers, nothing worked
 * out here), with "Tu participes" for an active participant. On a phone the
 * actions share the way back's row; from `md`, they sit right of the title.
 * What an action adds on a line of its own (col-span-full) goes below.
 */
export function ChallengeHeader({
  challenge,
  actions,
}: {
  challenge: ChallengeDetail;
  actions: ReactNode;
}) {
  const { t } = useTranslation();
  const facts = [
    t('challenges.participants', { count: challenge.participant_count }),
    t('challengeDetail.categoryCount', { count: challenge.categories.length }),
  ];
  if (challenge.current_week !== null) {
    facts.push(
      t('challengeDetail.weekOf', { week: challenge.current_week, count: challenge.week_count }),
    );
  }

  return (
    <header>
      {/* The actions are cells of this grid (display: contents): on a phone
          in the first row, from `md` right of the title. */}
      <div className="grid grid-cols-[1fr_auto_auto] items-start gap-x-2 gap-y-2 md:gap-x-3">
        <Link
          to="/"
          className="col-start-1 row-start-1 -ml-3 inline-flex h-11 min-w-11 items-center justify-center gap-1 justify-self-start rounded-full font-semibold text-muted md:col-span-3 md:justify-start md:px-2"
        >
          <ChevronLeft aria-hidden="true" size={22} strokeWidth={2} />
          <span className="sr-only md:not-sr-only">{t('challengeDetail.back')}</span>
        </Link>
        <div className="col-span-3 row-start-2 min-w-0 break-words md:col-span-1 md:col-start-1 md:self-center">
          <PageTitle>{challenge.title}</PageTitle>
        </div>
        <div className="contents">{actions}</div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-muted">
          {facts.map((fact, index) => (
            // A fact is never cut; the line breaks between them.
            <span key={fact}>
              {index > 0 && ' · '}
              <span className="whitespace-nowrap">{fact}</span>
            </span>
          ))}
        </p>
        {challenge.my_status === 'active' && (
          <StatusPill label={t('challengeDetail.participating')} Icon={Check} tone="neutral" />
        )}
      </div>

      {challenge.description && (
        <p className="mt-4 break-words whitespace-pre-line">{challenge.description}</p>
      )}
    </header>
  );
}
