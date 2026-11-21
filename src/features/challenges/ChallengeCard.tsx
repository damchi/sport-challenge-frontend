import { Globe, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { challengePeriod, otherTimeZoneName } from '../../domain/format/challengeDates';
import { ChallengeStatusPill, RolePills } from './ChallengePills';

interface ChallengeCardProps {
  challenge: ChallengeSummary;
  /** Shows the challenge's status (when the list is not filtered by it). */
  showStatus: boolean;
}

/**
 * A challenge of a list: title, my role, status, visibility, period in the
 * challenge's time zone (named when the user is elsewhere) and participants.
 */
export function ChallengeCard({ challenge, showStatus }: ChallengeCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const period = challengePeriod(
    challenge.starts_at,
    challenge.ends_at,
    challenge.timezone,
    locale,
  );
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = otherTimeZoneName(challenge.timezone, userTimeZone, locale);
  const VisibilityIcon = challenge.visibility === 'public' ? Globe : Lock;

  return (
    <Link
      to={`/challenges/${challenge.id}`}
      className="block rounded-card border border-border bg-surface p-4 [@media(hover:hover)]:hover:border-muted"
    >
      {/* The pills sit beside the title, under it when the text is enlarged. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h2 className="min-w-0 flex-1 basis-24 font-display text-lg font-bold break-words">
          {challenge.title}
        </h2>
        <div className="flex flex-wrap gap-1">
          <RolePills role={challenge.my_role} status={challenge.my_status} />
        </div>
      </div>
      {showStatus && (
        <div className="mt-2">
          <ChallengeStatusPill status={challenge.status} />
        </div>
      )}
      <p className="mt-2 text-sm text-muted">
        {t('challenges.period', period)}
        {zone && <> · {zone}</>}
      </p>
      <p className="mt-1 flex items-center gap-3 text-sm text-muted">
        <span className="inline-flex items-center gap-1">
          <VisibilityIcon aria-hidden="true" size={14} strokeWidth={2} />
          {t(`challenges.visibility.${challenge.visibility}`)}
        </span>
        <span>{t('challenges.participants', { count: challenge.participant_count })}</span>
      </p>
    </Link>
  );
}
