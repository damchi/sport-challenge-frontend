import { useTranslation } from 'react-i18next';
import { activityStart, otherTimeZoneName } from '../../domain/format/challengeDates';
import { formatEnteredKm } from '../../domain/format/distance';
import { formatActivityDuration } from '../../domain/format/duration';
import type { RecordedActivity } from '../../domain/schemas/activity';
import { useSportName } from '../challenges/create/useSportName';

/**
 * An activity in one line, for the preview and the reason dialog: "Course ·
 * jeudi 12 nov., 18:30 · 0:46:10 · 8,2 km", its start read in
 * `timeZone`, named when it is not the device's ("heure de l'Est").
 */
export function useActivityLine() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (activity: RecordedActivity, timeZone: string) => {
    const zone = otherTimeZoneName(timeZone, device, locale);
    return [
      activity.sport_code === 'other'
        ? (activity.sport_label ?? t('activities.otherSport'))
        : sportName(activity.sport_code),
      zone
        ? t('admin.activityForm.zoned', {
            start: activityStart(new Date(activity.started_at), timeZone, locale),
            zone,
          })
        : activityStart(new Date(activity.started_at), timeZone, locale),
      formatActivityDuration(activity.duration_seconds),
      ...(activity.distance_meters === null
        ? []
        : [formatEnteredKm(activity.distance_meters / 1000, locale)]),
    ].join(' · ');
  };
}
