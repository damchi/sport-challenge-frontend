import { ChevronLeft, Globe, Lock, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { PageTitle } from '../../../components/Page';
import {
  challengeInstant,
  challengePeriod,
  otherTimeZoneName,
} from '../../../domain/format/challengeDates';
import { ChallengeStatusPill, RolePills } from '../ChallengePills';

/**
 * Head of a challenge's page. Every date is in the challenge's time zone,
 * named when the user's differs, next to each hour too. The week and the registration lines show
 * only when the server gives them (current_week, can_join): nothing is
 * worked out here.
 */
export function ChallengeHeader({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const timeZone = challenge.timezone;
  const period = challengePeriod(challenge.starts_at, challenge.ends_at, timeZone, locale);
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = otherTimeZoneName(timeZone, userTimeZone, locale);
  const VisibilityIcon = challenge.visibility === 'public' ? Globe : Lock;

  return (
    <header>
      <Link
        to="/"
        className="-ml-3 inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full font-semibold text-muted md:justify-start md:px-2"
      >
        <ChevronLeft aria-hidden="true" size={22} strokeWidth={2} />
        <span className="sr-only md:not-sr-only">{t('challengeDetail.back')}</span>
      </Link>

      <div className="mt-2">
        <PageTitle>{challenge.title}</PageTitle>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <ChallengeStatusPill status={challenge.status} />
        <RolePills role={challenge.my_role} status={challenge.my_status} />
      </div>

      <p className="mt-3 text-sm text-muted">
        {t('challenges.period', period)}
        <span className="mx-2" aria-hidden="true">
          ·
        </span>
        <span className="inline-flex items-center gap-1">
          <VisibilityIcon aria-hidden="true" size={14} strokeWidth={2} />
          {t(`challenges.visibility.${challenge.visibility}`)}
        </span>
      </p>
      {zone && <p className="mt-1 text-sm text-muted">{t('challengeDetail.timeZone', { zone })}</p>}

      {challenge.current_week !== null && challenge.week_ends_at !== null && (
        <p className="mt-4 flex gap-3 rounded-row border border-raised-border bg-surface-raised p-4 text-on-raised md:max-w-md">
          <Timer aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 flex-none" />
          <span>
            <span className="block font-bold">
              {t('challengeDetail.week', { week: challenge.current_week })}
            </span>
            <span className="block text-sm text-on-raised-muted">
              {t('challengeDetail.weekEnds', {
                date: challengeInstant(challenge.week_ends_at, timeZone, locale),
                zone,
                context: zone && 'zone',
              })}
            </span>
          </span>
        </p>
      )}

      {challenge.can_join && (
        <p className="mt-4">
          {t('challengeDetail.registrationOpen', {
            date: challengeInstant(challenge.registration_deadline, timeZone, locale),
            zone,
            context: zone && 'zone',
          })}
        </p>
      )}

      {challenge.description && (
        <p className="mt-4 break-words whitespace-pre-line">{challenge.description}</p>
      )}
    </header>
  );
}
