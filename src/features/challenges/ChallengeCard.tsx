import { Ban, Check, Globe, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { StatusPill } from '../../components/StatusPill';
import { challengePeriod, otherTimeZoneName } from '../../domain/format/challengeDates';

/**
 * A challenge of a list: title, visibility, period in the challenge's time
 * zone (named when the user is elsewhere), participants and my participation.
 */
export function ChallengeCard({ challenge }: { challenge: ChallengeSummary }) {
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
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{challenge.title}</h2>
        {challenge.my_status === 'active' && (
          <StatusPill label={t('challenges.my.active')} Icon={Check} tone="ok" />
        )}
        {challenge.my_status === 'abandoned' && (
          <StatusPill label={t('challenges.my.abandoned')} Icon={Ban} tone="out" />
        )}
      </div>
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
