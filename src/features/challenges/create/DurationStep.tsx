import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { addToDate, isTimeZone, localDate } from '../../../domain/challengeWindow';
import { timeZoneName } from '../../../domain/format/challengeDates';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { groupTimeZones } from '../../../domain/timeZones';
import { FieldError } from './FieldError';
import { describedBy, inputClass } from './fields';
import { windowPreview } from './windowPreview';

// Bounds of the contract, which the buttons keep to.
const MIN_WEEKS = 2;
const MAX_WEEKS = 52;

/**
 * Step 2 of the creation: duration in weeks, the first day, then the time
 * zone of the place it is run from (the first day's bounds depend on it),
 * with the challenge's calendar in that time zone: its days and its weeks.
 * `now` dates "today"; `timeZones` are the ones the picker offers.
 */
export function DurationStep({ now, timeZones }: { now: Date; timeZones: readonly string[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const {
    register,
    control,
    getValues,
    setValue,
    trigger,
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
  // A duration being typed may be no number yet: the buttons start at the
  // bound.
  const typedWeeks = Number.isInteger(weeks) ? weeks : undefined;
  const changeWeeks = (by: number) => {
    const next = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, (typedWeeks ?? MIN_WEEKS - by) + by));
    setValue('weeks', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };
  const atMin = typedWeeks !== undefined && typedWeeks <= MIN_WEEKS;
  const atMax = typedWeeks !== undefined && typedWeeks >= MAX_WEEKS;
  const stepButton =
    'flex w-13 flex-none items-center justify-center text-ink hover-fill aria-disabled:text-muted aria-disabled:opacity-60';

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-2 md:gap-6">
        <div>
          <label htmlFor="weeks" className="block font-semibold">
            {t('challengeCreate.fields.weeks.label')}
          </label>
          <div
            className={`mt-2 flex h-13 overflow-hidden rounded-row border bg-surface ${weeksError ? 'border-2 border-risk-fg' : 'border-border'}`}
          >
            <button
              type="button"
              aria-label={t('challengeCreate.fields.weeks.less')}
              aria-controls="weeks"
              // aria-disabled, not disabled: the focus stays on the button at the bound.
              aria-disabled={atMin}
              onClick={() => {
                if (!atMin) changeWeeks(-1);
              }}
              className={`${stepButton} border-r border-border`}
            >
              <Minus aria-hidden="true" size={20} />
            </button>
            <span className="flex min-w-0 flex-1 items-stretch justify-center gap-1.5 font-bold">
              <input
                id="weeks"
                type="number"
                inputMode="numeric"
                min={MIN_WEEKS}
                max={MAX_WEEKS}
                step={1}
                aria-invalid={weeksError ? true : undefined}
                aria-describedby={describedBy('weeks', weeksError)}
                className="h-full w-12 [appearance:textfield] bg-transparent text-right text-ink [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                {...register('weeks', { valueAsNumber: true })}
              />
              <span aria-hidden="true" className="self-center">
                {t('challengeCreate.fields.weeks.unit', { count: typedWeeks ?? 0 })}
              </span>
            </span>
            <button
              type="button"
              aria-label={t('challengeCreate.fields.weeks.more')}
              aria-controls="weeks"
              aria-disabled={atMax}
              onClick={() => {
                if (!atMax) changeWeeks(1);
              }}
              className={`${stepButton} border-l border-border`}
            >
              <Plus aria-hidden="true" size={20} />
            </button>
          </div>
          <p id="weeks-hint" className="mt-2 text-sm text-muted">
            {t('challengeCreate.fields.weeks.hint')}
          </p>
          <FieldError id="weeks-error" message={weeksError} />
        </div>

        <div>
          <label htmlFor="start_date" className="block font-semibold">
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
            className={`${inputClass} h-13 w-full`}
            {...register('start_date')}
          />
          <p id="start_date-hint" className="mt-2 text-sm text-muted">
            {t('challengeCreate.fields.startDate.hint')}
          </p>
          <FieldError id="start_date-error" message={startDateError} />
        </div>
      </div>

      <div>
        <label htmlFor="timezone" className="block font-semibold">
          {t('challengeCreate.fields.timezone.label')}
        </label>
        <select
          id="timezone"
          aria-invalid={timeZoneError ? true : undefined}
          aria-describedby={describedBy('timezone', timeZoneError)}
          className={`${inputClass} h-13 w-full`}
          {...register('timezone', {
            // "Today" moves with the time zone: a date already entered is
            // checked again against it.
            onChange: () => {
              if (getValues('start_date')) void trigger('start_date');
            },
          })}
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
        <p id="timezone-hint" className="mt-2 text-sm text-muted">
          {t('challengeCreate.fields.timezone.hint')}
        </p>
        <FieldError id="timezone-error" message={timeZoneError} />
      </div>

      <section aria-labelledby="calendar-title" className="rounded-card bg-bg p-4 md:p-6">
        <h3 id="calendar-title" className="font-display text-lg font-bold">
          {t('challengeCreate.calendar.title')}
        </h3>
        {/* Read out as a whole when it changes, without the title. */}
        <div aria-live="polite" aria-atomic="true">
          {preview ? (
            <>
              <p className="mt-2">
                <Trans
                  i18nKey="challengeCreate.calendar.period"
                  values={{ start: preview.full.start, end: preview.full.end }}
                  components={{ b: <strong /> }}
                />
              </p>
              <p className="mt-1 text-sm text-muted">
                {t('challengeCreate.calendar.weekStart', {
                  day: preview.weekday,
                  zone: preview.zone,
                })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('challengeCreate.calendar.empty')}</p>
          )}
        </div>
        {preview && (
          <ol
            aria-label={t('challengeCreate.calendar.weeks')}
            className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"
          >
            {preview.weeks.map(({ start, end }, week) => (
              <li key={start} className="rounded-row border border-border bg-surface px-3 py-2">
                <span className="block font-bold">
                  {t('challengeCreate.calendar.week', { week: week + 1 })}
                </span>
                <span className="block text-sm text-muted">
                  {t('challengeCreate.calendar.weekDates', { start, end })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
