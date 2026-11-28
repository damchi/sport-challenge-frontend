import { useTranslation } from 'react-i18next';
import type { SettingField } from '../../domain/adminChallengeSettings';
import { factorSports, type CatalogueSport } from '../../domain/challengeCreate';
import { isCalendarDate, isTimeZone } from '../../domain/challengeWindow';
import { weekMonday } from '../../domain/format/activityDates';
import { formatFactor, formatKm } from '../../domain/format/distance';
import type { ChallengeCreateInput } from '../../domain/schemas/challenge';
import { timeZoneCity } from '../../domain/timeZones';
import type { PreviousValue } from '../challenges/create/ChangedPill';
import { useSportName } from '../challenges/create/useSportName';

/** A setting the form changes, as the admin reads it. */
export interface SettingChange {
  field: SettingField;
  label: string;
  /** Null for a setting shown without its values (the description). */
  before: string | null;
  after: string | null;
}

type Toggle = 'cumulative_distance' | 'elimination' | 'points' | 'cumulative_elevation';

// Whether the category's name is feminine, for "Incluse" or "Inclus".
const FEMININE: Record<Toggle, boolean> = {
  cumulative_distance: true,
  elimination: true,
  points: false,
  cumulative_elevation: false,
};

type FactorField = `factors.${string}`;

const isFactor = (field: SettingField): field is FactorField => field.startsWith('factors.');

// Every setting but the factors and the elimination, named after a sport.
const LABELS: Record<Exclude<SettingField, FactorField | 'elimination'>, string> = {
  title: 'challengeCreate.fields.title.label',
  description: 'challengeCreate.recap.description',
  visibility: 'challengeCreate.recap.visibility',
  members_can_invite: 'challengeCreate.recap.invitations',
  weeks: 'challengeCreate.fields.weeks.label',
  start_date: 'challengeCreate.fields.startDate.label',
  timezone: 'challengeCreate.fields.timezone.label',
  reference_sport: 'challengeCreate.fields.referenceSport.label',
  cumulative_distance: 'challengeCreate.categories.distance.name',
  points: 'challengeDetail.categories.points',
  cumulative_elevation: 'challengeCreate.categories.elevation.name',
  elimination_step_km: 'challengeCreate.fields.eliminationStep.label',
  elimination_exercise: 'challengeCreate.fields.eliminationExercise.label',
  elimination_step_repetitions: 'challengeCreate.fields.eliminationStep.label',
  points_criteria: 'challengeCreate.fields.pointsCriteria.label',
  points_podium: 'challengeCreate.fields.pointsPodium.label',
  points_min_session_minutes: 'admin.settings.minSession',
};

/**
 * The settings the form changes (`changed`), each with its label and its
 * values before and after as read; and, for the pills beside the fields,
 * the former value of each (`previous`), the factors as a whole included.
 */
export function useSettingsChanges(
  initial: ChallengeCreateInput,
  values: ChallengeCreateInput,
  changed: readonly SettingField[],
  sports: readonly CatalogueSport[],
): { changes: SettingChange[]; previous: PreviousValue } {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const empty = t('admin.settings.empty');
  const number = (value: number | undefined, read: (value: number) => string) =>
    value !== undefined && Number.isFinite(value) ? read(value) : empty;

  // A setting's value in `input`, as read; null for the description.
  const read = (field: SettingField, input: ChallengeCreateInput): string | null => {
    if (field.startsWith('factors.')) {
      const code = field.slice('factors.'.length);
      const suggested = factorSports(sports, input.reference_sport).find(
        (sport) => sport.code === code,
      )?.suggested;
      return number(input.factors[code] ?? suggested, (factor) => formatFactor(factor, locale));
    }
    switch (field) {
      case 'title':
        return input.title.trim();
      case 'description':
        return null;
      case 'visibility':
        return input.visibility
          ? t(`challengeCreate.fields.visibility.${input.visibility}`)
          : empty;
      case 'members_can_invite':
        return t(
          input.members_can_invite
            ? 'challengeCreate.recap.allInvite'
            : 'challengeCreate.recap.creatorsOnly',
        );
      case 'weeks':
        return number(input.weeks, (count) => t('admin.settings.weeks', { count }));
      case 'start_date':
        return isCalendarDate(input.start_date)
          ? weekMonday(input.start_date, locale, true)
          : empty;
      case 'timezone':
        return isTimeZone(input.timezone) ? timeZoneCity(input.timezone) : empty;
      case 'reference_sport':
        return sportName(input.reference_sport);
      case 'cumulative_distance':
      case 'elimination':
      case 'points':
      case 'cumulative_elevation': {
        const feminine = FEMININE[field];
        return input[field]
          ? t(
              feminine
                ? 'challengeCreate.recap.includedFeminine'
                : 'challengeCreate.recap.included',
            )
          : t(
              feminine
                ? 'challengeCreate.recap.excludedFeminine'
                : 'challengeCreate.recap.excluded',
            );
      }
      case 'elimination_step_km':
        return number(input.elimination_step_km, (km) => formatKm(km, locale));
      case 'elimination_exercise': {
        const exercise = input.elimination_exercise;
        return exercise ? t(`exercises.${exercise}`, { defaultValue: exercise }) : empty;
      }
      case 'elimination_step_repetitions':
        return number(input.elimination_step_repetitions, (count) =>
          t('challengeCreate.fields.eliminationRepetitions.count', { count }),
        );
      case 'points_criteria':
        return input.points_criteria.length > 0
          ? input.points_criteria
              .map((criterion) =>
                t(`challengeDetail.categories.pointsParams.criteria.${criterion}`),
              )
              .join(', ')
          : empty;
      case 'points_podium':
        return input.points_podium
          ? t(`challengeCreate.fields.pointsPodium.name_${input.points_podium}`)
          : empty;
      case 'points_min_session_minutes':
        return number(input.points_min_session_minutes, (count) =>
          t('admin.settings.minutes', { count }),
        );
    }
    return empty;
  };

  const label = (field: SettingField) => {
    if (isFactor(field)) {
      return t('admin.settings.factor', { sport: sportName(field.slice('factors.'.length)) });
    }
    if (field === 'elimination') {
      return t('challengeDetail.categories.elimination', {
        sport: sportName(values.reference_sport),
      });
    }
    return t(LABELS[field]);
  };

  const changes = changed.map((field) => ({
    field,
    label: label(field),
    before: read(field, initial),
    after: read(field, values),
  }));
  const previous: PreviousValue = (field) => {
    if (field === 'factors') {
      return changed.some((one) => one.startsWith('factors.')) ? null : undefined;
    }
    const change = changes.find((one) => one.field === field);
    return change ? change.before : undefined;
  };
  return { changes, previous };
}
