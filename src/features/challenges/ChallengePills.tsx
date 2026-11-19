import { Ban, CalendarClock, Check, Crown, Flag, Play, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { StatusPill } from '../../components/StatusPill';

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

/** My role in a challenge, from `my_role` and `my_status` of the API. */
export function RolePills({ role, status }: { role: Role; status: ChallengeSummary['my_status'] }) {
  const { t } = useTranslation();
  const pill = ROLE_PILLS[role];
  return (
    <>
      {pill && (
        <StatusPill label={t(`challenges.role.${role}`)} Icon={pill.Icon} tone={pill.tone} />
      )}
      {/* A creator who abandoned keeps the role but no longer competes. */}
      {role === 'creator' && status === 'abandoned' && (
        <StatusPill label={t('challenges.role.abandoned')} Icon={Ban} tone="out" />
      )}
    </>
  );
}

/** Status of a challenge, as the server computes it. */
export function ChallengeStatusPill({ status }: { status: Status }) {
  const { t } = useTranslation();
  return (
    <StatusPill
      label={t(`challenges.challengeStatus.${status}`)}
      Icon={STATUS_ICONS[status]}
      tone="neutral"
    />
  );
}
