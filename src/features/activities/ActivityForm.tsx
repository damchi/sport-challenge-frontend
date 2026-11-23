import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError, errorMessage } from '../../api/errors';
import { useCreateActivity, type Activity } from '../../api/hooks/useActivities';
import type { Sport } from '../../api/hooks/useSports';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { sortSportsForEntry } from '../../domain/activity';
import { toZonedDateTime } from '../../domain/challengeWindow';
import { timeZoneName } from '../../domain/format/challengeDates';
import {
  activityCreateSchema,
  activityFormFieldOf,
  type ActivityCreateInput,
  type ActivityCreateValues,
} from '../../domain/schemas/activity';
import { FieldError } from '../challenges/create/FieldError';
import { describedBy, inputClass } from '../challenges/create/fields';
import { useLeaveWarning } from '../challenges/create/useLeaveWarning';
import { useSportName } from '../challenges/create/useSportName';
import { ActivitySaved } from './ActivitySaved';
import { ActivitySummary } from './ActivitySummary';
import { useActivityFormData } from './useActivityFormData';

const DURATION_PARTS = ['hours', 'minutes', 'seconds'] as const;
const DURATION_UNITS = {
  hours: 'activityForm.fields.duration.unitHours',
  minutes: 'activityForm.fields.duration.unitMinutes',
  seconds: 'activityForm.fields.duration.unitSeconds',
} as const;
// Statuses of POST /activities that record nothing.
const REFUSED_FOR_GOOD = new Set([400, 404, 422]);

// A section's title: "Sport", "Début", "Durée", "Distance".
const legendClass = 'font-display text-lg font-bold';
// A sport to pick: accent once chosen, the ring adding the second pixel
// without moving the text (the state is not given by the colour alone).
const sportChipClass =
  'flex min-h-13 cursor-pointer items-center justify-center rounded-row border border-border bg-surface px-2 py-2 text-center text-sm font-bold break-words hyphens-auto md:text-base has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:checked]:ring-1 has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent';
// The unit written inside a field, at its end.
const unitClass =
  'pointer-events-none absolute inset-y-0 right-4 flex items-center font-semibold text-muted';

const EMPTY: ActivityCreateInput = {
  sport_code: '',
  sport_label: '',
  start_date: '',
  start_time: '',
  hours: '',
  minutes: '',
  seconds: '',
  distance_km: '',
};

/**
 * Entry of an activity, once the catalogue of sports and the user's ongoing
 * challenges are loaded: the start is read in their time zone when they
 * share one, in the device's otherwise. Tests give `now`, the device's time
 * zone and the maker of idempotency keys. Once recorded, the outcome stays
 * whatever the queries reloading afterwards do.
 */
export function ActivityForm({
  now,
  deviceTimeZone,
  newIdempotencyKey,
}: {
  now?: () => Date;
  deviceTimeZone?: string;
  newIdempotencyKey?: () => string;
}) {
  const { t } = useTranslation();
  const makeKey = newIdempotencyKey ?? (() => crypto.randomUUID());
  const createActivity = useCreateActivity();
  // Chosen once per entry; it goes with every attempt that may have been
  // recorded.
  const [idempotencyKey, setIdempotencyKey] = useState(makeKey);
  const [saved, setSaved] = useState<Activity>();
  const loaded = useActivityFormData(deviceTimeZone, saved !== undefined);
  if (saved) {
    return (
      <ActivitySaved title={t('activityForm.saved.title')} contributions={saved.contributions} />
    );
  }
  if (loaded.state !== 'ready') return loaded.view;

  const record = async (activity: ActivityCreateValues) => {
    try {
      setSaved(await createActivity.mutateAsync({ activity, idempotencyKey }));
    } catch (error) {
      // Refused for good by the contract (400, 404, 422): nothing was
      // recorded, the corrected entry goes with a new key. Otherwise (no
      // answer, server error, timeout) it may have been: the same key comes
      // again, so nothing is recorded twice.
      if (error instanceof ApiError && REFUSED_FOR_GOOD.has(error.status)) {
        setIdempotencyKey(makeKey());
      }
      throw error;
    }
  };

  return (
    <ActivityFormFields
      sports={loaded.sports}
      timeZone={loaded.timeZone}
      now={now ?? (() => new Date())}
      initialValues={EMPTY}
      submitKey="activityForm.submit"
      busy={createActivity.isPending}
      save={record}
    />
  );
}

/**
 * The fields: a sport of the catalogue, picked among chips in the mockups'
 * order (or "other", with a free label), the start's day and time, read in
 * `timeZone` and said so, the duration (always) and the distance, shown only
 * when the sport has one: required, or optional for "other". No speed: the
 * API computes it. A summary of the entry goes with them. They open with
 * `initialValues`; `save` sends the request and throws the API's refusal,
 * shown here: on the refused fields, or above the button (`weekLockedKey`
 * words a week that has ended). `submitKey` holds the button's label and
 * busy label. Leaving with a changed entry asks first.
 */
export function ActivityFormFields({
  sports,
  timeZone,
  now,
  initialValues,
  submitKey,
  busy,
  save,
  weekLockedKey,
}: {
  sports: readonly Sport[];
  timeZone: string;
  now: () => Date;
  initialValues: ActivityCreateInput;
  submitKey: 'activityForm.submit' | 'activityEdit.submit';
  busy: boolean;
  save: (activity: ActivityCreateValues) => Promise<void>;
  weekLockedKey?: 'activityEdit.weekLocked';
}) {
  const { t, i18n } = useTranslation();
  const sportName = useSportName();
  const [submitError, setSubmitError] = useState<string>();
  // Set at once, unlike the mutation's state: a second click in the same
  // instant sends nothing.
  const sending = useRef(false);
  // The next refusal message takes the focus once shown.
  const focusError = useRef(false);
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sorted = sortSportsForEntry(sports, sportName, locale);
  const form = useForm<ActivityCreateInput, unknown, ActivityCreateValues>({
    resolver: zodResolver(activityCreateSchema(now, sports, timeZone)),
    // Checked once the field is left, then at each keystroke.
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: initialValues,
  });
  const {
    register,
    formState: { errors, dirtyFields },
  } = form;
  // Saved, the form gives way to the outcome: the warning goes with it.
  const blocker = useLeaveWarning(Object.keys(dirtyFields).length > 0);
  const sportCode = useWatch({ control: form.control, name: 'sport_code' });
  const mode = sports.find((sport) => sport.code === sportCode)?.distance_mode;

  // validation_failed names the refused fields: each shows an error where it
  // is entered. Other codes are said above the button.
  const showError = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'validation_failed') {
      const fields = (error.params.fields ?? '')
        .split(',')
        .map((field) => activityFormFieldOf(field.trim()))
        .filter((field) => field !== undefined);
      // The first refused field takes the focus.
      fields.forEach((field, index) =>
        form.setError(
          field,
          { message: 'activityForm.fields.serverInvalid' },
          { shouldFocus: index === 0 },
        ),
      );
      if (fields.length > 0) {
        setSubmitError(t('errors.validation_failed'));
        return;
      }
    }
    const { key, values } =
      error instanceof ApiError
        ? weekLockedKey && error.code === 'week_locked'
          ? { key: weekLockedKey, values: {} }
          : errorMessage(error, (candidate) => i18n.exists(candidate))
        : { key: 'errors.unknown', values: {} };
    setSubmitError(t(key, values));
    // Said where the eye is: the message may be off screen on a phone.
    focusError.current = true;
  };

  const submit = async (activity: ActivityCreateValues) => {
    if (sending.current) return;
    sending.current = true;
    setSubmitError(undefined);
    try {
      await save(activity);
    } catch (error) {
      showError(error);
      sending.current = false;
    }
  };

  const sportError = errors.sport_code?.message;
  const labelError = errors.sport_label?.message;
  const startError = errors.start_date?.message;
  const durationError = errors.hours?.message;
  const distanceError = errors.distance_km?.message;
  const hasDistance = mode === 'required' || mode === 'optional';
  const [today] = toZonedDateTime(now(), timeZone).split('T');

  return (
    <>
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
        // From lg: the fields and their actions in one card, the summary
        // beside them. Before: one column, the summary before the actions.
        className="mt-4 flex flex-col gap-8 md:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-6 lg:gap-y-0"
      >
        <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-1 lg:rounded-t-card lg:border-x lg:border-t lg:border-border lg:bg-surface lg:px-8 lg:pt-8">
          <fieldset
            className="min-w-0"
            aria-describedby={sportError ? 'sport_code-error' : undefined}
          >
            <legend className={legendClass}>{t('activityForm.fields.sport.label')}</legend>
            <div className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-5">
              {sorted.map(({ code }) => (
                <label key={code} className={sportChipClass}>
                  <input
                    type="radio"
                    value={code}
                    aria-invalid={sportError ? true : undefined}
                    className="sr-only"
                    {...register('sport_code')}
                  />
                  {sportName(code)}
                </label>
              ))}
            </div>
            <FieldError id="sport_code-error" message={sportError} />
          </fieldset>

          {sportCode === 'other' && (
            <div className="-mt-4">
              <label htmlFor="sport_label" className="block font-semibold">
                {t('activityForm.fields.sportLabel.label')}
              </label>
              <input
                id="sport_label"
                autoComplete="off"
                aria-invalid={labelError ? true : undefined}
                aria-describedby={describedBy('sport_label', labelError)}
                className={`${inputClass} h-13 w-full`}
                {...register('sport_label')}
              />
              <p id="sport_label-hint" className="mt-1 text-sm text-muted">
                {t('activityForm.fields.sportLabel.hint')}
              </p>
              <FieldError id="sport_label-error" message={labelError} />
            </div>
          )}

          {/* min-w-0: a fieldset takes its content's width by default, and
              native date fields with enlarged text would pass the screen. */}
          <fieldset className="min-w-0" aria-describedby={describedBy('start', startError)}>
            <legend className={legendClass}>{t('activityForm.fields.startedAt.label')}</legend>
            {/* Side by side, one under the other when the text is enlarged. */}
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="min-w-36 flex-1">
                <label htmlFor="start_date" className="block font-semibold">
                  {t('activityForm.fields.startedAt.date')}
                </label>
                <input
                  id="start_date"
                  type="date"
                  // Today there: the schema checks the whole start at sending.
                  max={today}
                  aria-invalid={startError ? true : undefined}
                  aria-describedby={describedBy('start', startError)}
                  className={`${inputClass} h-13 w-full`}
                  {...register('start_date', { deps: ['start_time'] })}
                />
              </div>
              <div className="min-w-36 flex-1">
                <label htmlFor="start_time" className="block font-semibold">
                  {t('activityForm.fields.startedAt.time')}
                </label>
                <input
                  id="start_time"
                  type="time"
                  aria-invalid={startError ? true : undefined}
                  aria-describedby={describedBy('start', startError)}
                  className={`${inputClass} h-13 w-full`}
                  {...register('start_time', { deps: ['start_date'] })}
                />
              </div>
            </div>
            <p id="start-hint" className="mt-2 text-sm text-muted">
              {t('activityForm.fields.startedAt.hint', { zone: timeZoneName(timeZone, locale) })}
            </p>
            <FieldError id="start-error" message={startError} />
          </fieldset>

          <fieldset className="min-w-0" aria-describedby={describedBy('duration', durationError)}>
            <legend className={legendClass}>{t('activityForm.fields.duration.label')}</legend>
            {/* Side by side, one under the other when the text is enlarged. */}
            <div className="mt-3 flex flex-wrap gap-3">
              {DURATION_PARTS.map((part) => (
                <div key={part} className="relative min-w-24 flex-1">
                  <label htmlFor={part} className="sr-only">
                    {t(`activityForm.fields.duration.${part}`)}
                  </label>
                  <input
                    id={part}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={durationError ? true : undefined}
                    aria-describedby={describedBy('duration', durationError)}
                    className={`${inputClass} mt-0! h-13 w-full pr-14`}
                    {...register(part, {
                      // One error for the three parts: each change checks it again.
                      deps: DURATION_PARTS.filter((other) => other !== part),
                    })}
                  />
                  <span aria-hidden="true" className={unitClass}>
                    {t(DURATION_UNITS[part])}
                  </span>
                </div>
              ))}
            </div>
            <p id="duration-hint" className="mt-2 text-sm text-muted">
              {t('activityForm.fields.duration.hint')}
            </p>
            <FieldError id="duration-error" message={durationError} />
          </fieldset>

          {hasDistance && (
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <label htmlFor="distance_km" className={legendClass}>
                  {t('activityForm.fields.distance.label')}{' '}
                  <span className="sr-only">{t('activityForm.fields.distance.unitLong')}</span>
                </label>
                <span id="distance_km-tag" className="text-sm text-muted">
                  {t(
                    mode === 'required'
                      ? 'activityForm.fields.distance.tagRequired'
                      : 'activityForm.fields.distance.tagOptional',
                  )}
                </span>
              </div>
              <div className="relative mt-3 lg:max-w-sm">
                <input
                  id="distance_km"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={distanceError ? true : undefined}
                  aria-describedby={[
                    'distance_km-tag',
                    ...(mode === 'optional' ? ['distance_km-hint'] : []),
                    ...(distanceError ? ['distance_km-error'] : []),
                  ].join(' ')}
                  className={`${inputClass} mt-0! h-13 w-full pr-14`}
                  {...register('distance_km')}
                />
                <span aria-hidden="true" className={unitClass}>
                  {t('activityForm.fields.distance.unit')}
                </span>
              </div>
              {mode === 'optional' && (
                <p id="distance_km-hint" className="mt-2 text-sm text-muted">
                  {t('activityForm.fields.distance.hintOptional')}
                </p>
              )}
              <FieldError id="distance_km-error" message={distanceError} />
            </div>
          )}
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <ActivitySummary control={form.control} timeZone={timeZone} hasDistance={hasDistance} />
        </div>

        {/* Held above the phone's navigation bar; in the card from lg. */}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-5 flex flex-col gap-3 border-t border-border bg-bg px-5 py-3 md:static md:mx-0 md:border-t-0 md:bg-transparent md:px-0 md:py-0 lg:col-start-1 lg:row-start-2 lg:rounded-b-card lg:border-x lg:border-b lg:border-border lg:bg-surface lg:px-8 lg:pt-10 lg:pb-8">
          {submitError && (
            <p
              ref={(element) => {
                if (element && focusError.current) {
                  focusError.current = false;
                  element.focus();
                }
              }}
              tabIndex={-1}
              role="alert"
              className="font-semibold text-risk-fg"
            >
              {submitError}
            </p>
          )}
          <div className="flex items-center gap-6">
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy ? true : undefined}
              // Whole line on a phone; its own width from md.
              className="h-13 flex-1 rounded-full bg-accent px-8 text-button font-bold text-on-accent disabled:opacity-60 md:flex-none"
            >
              {busy ? t(`${submitKey}.busy`) : t(`${submitKey}.label`)}
            </button>
            {/* A phone leaves by the arrow of the header. */}
            <Link
              to="/activities"
              className="hidden h-11 items-center font-semibold text-muted underline underline-offset-4 md:inline-flex"
            >
              {t('activityForm.cancel')}
            </Link>
          </div>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={t('activityForm.leave.title')}
        message={t('activityForm.leave.message')}
        confirmLabel={t('activityForm.leave.confirm')}
        cancelLabel={t('activityForm.leave.cancel')}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}
