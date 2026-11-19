import {
  Ban,
  CalendarClock,
  Check,
  Crown,
  Flag,
  Globe,
  Lock,
  Play,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { StatusPill } from '../../components/StatusPill';
import { challengePeriod, otherTimeZoneName } from '../../domain/format/challengeDates';

type Role = ChallengeSummary['my_role'];
type Status = ChallengeSummary['status'];

// My role as the server gives it; invited and outsider show nothing.
const ROLE_PILLS: Partial<Record<Role, { Icon: LucideIcon; tone: 'ok' | 'out' }>> = {
  creator: { Icon: Crown, tone: 'ok' },
  participant: { Icon: Check, tone: 'ok' },
  abandoned: { Icon: Ban, tone: 'out' },
};

const STATUS_ICONS: Record<Status, LucideIcon> = {
  upcoming: CalendarClock,
  ongoing: Play,
  finished: Flag,
};

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
  const role = ROLE_PILLS[challenge.my_role];

  return (
    <Link
      to={`/challenges/${challenge.id}`}
      className="block rounded-card border border-border bg-surface p-4 [@media(hover:hover)]:hover:border-muted"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{challenge.title}</h2>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {role && (
            <StatusPill
              label={t(`challenges.role.${challenge.my_role}`)}
              Icon={role.Icon}
              tone={role.tone}
            />
          )}
          {/* A creator who abandoned keeps the role but no longer competes. */}
          {challenge.my_role === 'creator' && challenge.my_status === 'abandoned' && (
            <StatusPill label={t('challenges.role.abandoned')} Icon={Ban} tone="out" />
          )}
        </div>
      </div>
      {showStatus && (
        <div className="mt-2">
          <StatusPill
            label={t(`challenges.challengeStatus.${challenge.status}`)}
            Icon={STATUS_ICONS[challenge.status]}
            tone="neutral"
          />
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
