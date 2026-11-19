import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  addToDate,
  challengeWindow,
  isCalendarDate,
  isStartDateInRange,
  isTimeZone,
  localDate,
} from '../../../domain/challengeWindow';
import { challengeWindowBounds, timeZoneName } from '../../../domain/format/challengeDates';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { groupTimeZones } from '../../../domain/timeZones';
import { FieldError } from './FieldError';
import { describedBy, inputClass } from './fields';

// The window as it will run, once the three fields are valid: never one the
// form would refuse.
function windowPreview(
  startDate: string,
  weeks: number,
  timeZone: string,
  now: Date,
  locale: string,
) {
  if (
    !isCalendarDate(startDate) ||
    !isStartDateInRange(startDate, timeZone, now) ||
    !Number.isInteger(weeks) ||
    weeks < 2 ||
    weeks > 52
  ) {
    return undefined;
  }
  const { startsAt, endsAt } = challengeWindow(startDate, weeks, timeZone);
  return {
    ...challengeWindowBounds(startsAt, endsAt, timeZone, locale),
    zone: timeZoneName(timeZone, locale),
  };
}

/**
 * Step 2 of the creation: duration in weeks, the time zone of the place it is
 * run from, then the start date (its bounds depend on the time zone), with a
 * preview of the window in that time zone.
 * `now` dates "today"; `timeZones` are the ones the picker offers.
 */
export function DurationStep({ now, timeZones }: { now: Date; timeZones: readonly string[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ChallengeCreateInput>();
  const [weeks, startDate, timeZone] = useWatch({
    control,
    name: ['weeks', 'start_date', 'timezone'],
  });
  const groups = useMemo(
    () =>
      groupTimeZones(timeZones).map(({ region, zones }) => ({
        region,
        zones: zones.map(({ id, city }) => ({
          id,
          label: t('challengeCreate.fields.timezone.option', {
            city,
            name: timeZoneName(id, locale),
          }),
        })),
      })),
    [timeZones, locale, t],
  );

  const validZone = isTimeZone(timeZone) ? timeZone : undefined;
  const today = validZone ? localDate(now, validZone) : undefined;
  const preview = validZone && windowPreview(startDate, weeks, validZone, now, locale);
  const weeksError = errors.weeks?.message;
  const startDateError = errors.start_date?.message;
  const timeZoneError = errors.timezone?.message;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor="weeks" className="block text-sm font-semibold">
          {t('challengeCreate.fields.weeks.label')}
        </label>
        <input
          id="weeks"
          type="number"
          inputMode="numeric"
          min={2}
          max={52}
          step={1}
          aria-invalid={weeksError ? true : undefined}
          aria-describedby={describedBy('weeks', weeksError)}
          className={`${inputClass} h-11`}
          {...register('weeks', { valueAsNumber: true })}
        />
        <p id="weeks-hint" className="mt-1 text-sm text-muted">
          {t('challengeCreate.fields.weeks.hint')}
        </p>
        <FieldError id="weeks-error" message={weeksError} />
      </div>

      <div>
        <label htmlFor="timezone" className="block text-sm font-semibold">
          {t('challengeCreate.fields.timezone.label')}
        </label>
        <select
          id="timezone"
          aria-invalid={timeZoneError ? true : undefined}
          aria-describedby={describedBy('timezone', timeZoneError)}
          className={`${inputClass} h-11`}
          {...register('timezone')}
        >
          <option value="">{t('challengeCreate.fields.timezone.placeholder')}</option>
          {groups.map(({ region, zones }) => (
            <optgroup key={region} label={t(`challengeCreate.fields.timezone.regions.${region}`)}>
              {zones.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p id="timezone-hint" className="mt-1 text-sm text-muted">
          {t('challengeCreate.fields.timezone.hint')}
        </p>
        <FieldError id="timezone-error" message={timeZoneError} />
      </div>

      <div>
        <label htmlFor="start_date" className="block text-sm font-semibold">
          {t('challengeCreate.fields.startDate.label')}
        </label>
        <input
          id="start_date"
          type="date"
          // Bounds of the contract, in the chosen time zone.
          min={today}
          max={today && addToDate(today, { years: 1 })}
          aria-invalid={startDateError ? true : undefined}
          aria-describedby={describedBy('start_date', startDateError)}
          className={`${inputClass} h-11`}
          {...register('start_date')}
        />
        <p id="start_date-hint" className="mt-1 text-sm text-muted">
          {t('challengeCreate.fields.startDate.hint')}
        </p>
        <FieldError id="start_date-error" message={startDateError} />
      </div>

      <section
        aria-labelledby="preview-title"
        className="rounded-row border border-border bg-surface p-4"
      >
        <h3 id="preview-title" className="text-sm font-semibold">
          {t('challengeCreate.preview.title')}
        </h3>
        {/* Read out as a whole when it changes, without the title. */}
        <div aria-live="polite" aria-atomic="true">
          {preview ? (
            <>
              <p className="mt-1">
                {t('challengeCreate.preview.period', {
                  start: preview.start,
                  end: preview.end,
                  zone: preview.zone,
                })}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t('challengeCreate.preview.weeks', { count: weeks })}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">{t('challengeCreate.preview.empty')}</p>
          )}
        </div>
      </section>
    </div>
  );
}
