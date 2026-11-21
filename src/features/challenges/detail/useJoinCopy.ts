import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { challengeInstant, otherTimeZoneName } from '../../../domain/format/challengeDates';

/**
 * Texts of joining a challenge, shared by its page and the invitation page:
 * the name of the challenge's time zone when the user's differs (`zone`),
 * the registration deadline in that zone, and why the user cannot join when the server says so
 * (can_join false), read from their participation: in, abandoned for good,
 * or registration closed (the only reason left to a user who sees it).
 */
export function useJoinCopy(challenge: ChallengeDetail) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const zone = otherTimeZoneName(
    challenge.timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );
  const deadline = {
    date: challengeInstant(challenge.registration_deadline, challenge.timezone, locale),
    zone,
    context: zone && 'zone',
  };
  const reason =
    challenge.my_status === 'active'
      ? t('challengeDetail.join.participant')
      : challenge.my_status === 'abandoned'
        ? t('challengeDetail.join.abandoned')
        : t('challengeDetail.join.closed', deadline);
  return { zone, deadline, reason };
}
