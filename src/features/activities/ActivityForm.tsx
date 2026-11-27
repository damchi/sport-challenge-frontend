import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError, errorMessage } from '../../api/errors';
import { useCreateActivity, useUpdateActivity, type Activity } from '../../api/hooks/useActivities';
import type { Sport } from '../../api/hooks/useSports';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { holdsEntry, sortSportsForEntry } from '../../domain/activity';
import { toZonedDateTime } from '../../domain/challengeWindow';
import { timeZoneName } from '../../domain/format/challengeDates';
import {
  activityCreateSchema,
  activityFormFieldOf,
  EMPTY_ACTIVITY_INPUT,
  takesElevation,
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
// The start's time of day: an hour and minutes, on 24 hours.
const CLOCK_PARTS = ['start_hour', 'start_minute'] as const;
const CLOCK_LABELS = {
  start_hour: 'activityForm.fields.startedAt.hour',
  start_minute: 'activityForm.fields.startedAt.minute',
} as const;
const CLOCK_UNITS = {
  start_hour: 'activityForm.fields.duration.unitHours',
  start_minute: 'activityForm.fields.duration.unitMinutes',
} as const;
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
  'flex min-h-13 cursor-pointer items-center justify-center rounded-row border border-border bg-surface px-2 py-2 hover-choice text-center text-sm font-bold break-words hyphens-auto md:text-base has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:checked]:ring-1 has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent';
// The unit written inside a field, at its end.
const unitClass =
  'pointer-events-none absolute inset-y-0 right-4 flex items-center font-semibold text-muted';

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
  const { t, i18n } = useTranslation();
  const makeKey = newIdempotencyKey ?? (() => crypto.randomUUID());
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  // Chosen once per entry; it goes with every attempt that may have been
  // recorded.
  const [idempotencyKey, setIdempotencyKey] = useState(makeKey);
  // An attempt with this key got no clear answer: it may have been recorded.
  const uncertain = useRef(false);
  const [saved, setSaved] = useState<Activity>();
  // Why the entry corrected after an uncertain attempt was not applied.
  const [correctionRefused, setCorrectionRefused] = useState<string>();
  const loaded = useActivityFormData(deviceTimeZone, saved !== undefined);
  if (saved) {
    return (
      <ActivitySaved
        title={t('activityForm.saved.title')}
        contributions={saved.contributions}
        refusal={
          correctionRefused &&
          t('activityForm.saved.correctionRefused', { reason: correctionRefused })
        }
      />
    );
  }
  if (loaded.state !== 'ready') return loaded.view;

  const record = async (activity: ActivityCreateValues) => {
    let created: Activity;
    try {
      created = await createActivity.mutateAsync({ activity, idempotencyKey });
    } catch (error) {
      // Refused for good by the contract (400, 404, 422): this attempt
      // recorded nothing, the corrected entry goes with a new key, unless an
      // uncertain attempt came first: it may have been recorded, and only
      // its key gives it back, so the key stays until the server says it is
      // gone. Otherwise (no answer, server error, timeout) this one may have
      // been: the same key comes again, so nothing is recorded twice.
      if (!(error instanceof ApiError && REFUSED_FOR_GOOD.has(error.status))) {
        uncertain.current = true;
      } else if (!uncertain.current || error.code === 'activity_not_found') {
        setIdempotencyKey(makeKey());
        uncertain.current = false;
      }
      throw error;
    }
    if (!uncertain.current || holdsEntry(created, activity)) {
      setSaved(created);
      return;
    }
    // An uncertain attempt was recorded after all, with the entry as it was
    // then: the server gives it back, whatever was sent again. The entry
    // corrected since replaces it (owner's decision, 2026-11-26).
    try {
      setSaved(await updateActivity.mutateAsync({ activityId: created.id, activity }));
    } catch (error) {
      const { key, values } =
        error instanceof ApiError
          ? error.code === 'week_locked'
            ? { key: 'activityEdit.weekLocked', values: {} }
            : errorMessage(error, (candidate) => i18n.exists(candidate))
          : { key: 'errors.unknown', values: {} };
      setCorrectionRefused(t(key, values));
      setSaved(created);
    }
  };

  return (
    <ActivityFormFields
      sports={loaded.sports}
      timeZone={loaded.timeZone}
      now={now ?? (() => new Date())}
      initialValues={EMPTY_ACTIVITY_INPUT}
      submitKey="activityForm.submit"
      busy={createActivity.isPending || updateActivity.isPending}
      save={record}
    />
  );
}

/**
 * The fields: a sport of the catalogue, picked among chips in the mockups'
 * order (or "other", with a free label), the start's day and time, read in
 * `timeZone` and said so, the duration (always) and the distance, shown only
 * when the sport has one: required, or optional for "other", then the
 * optional elevation gain, shown only when the sport takes one and a
 * distance is typed (emptied once hidden). No speed: the
 * API computes it. A summary of the entry goes with them. They open with
 * `initialValues`; `save` sends the request and throws the API's refusal,
 * shown here: on the refused fields, or above the button (`weekLockedKey`
 * words a week that has ended; `errorScope` holds the caller's own words for
 * the API's codes). `submitKey` holds the button's label and busy label;
 * "Annuler" goes to `cancelTo`. Leaving with a changed entry asks first.
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
  errorScope,
  cancelTo = '/activities',
}: {
  sports: readonly Sport[];
  timeZone: string;
  now: () => Date;
  initialValues: ActivityCreateInput;
  submitKey: 'activityForm.submit' | 'activityEdit.submit' | 'admin.activityForm.preview';
  busy: boolean;
  save: (activity: ActivityCreateValues) => Promise<void>;
  weekLockedKey?: 'activityEdit.weekLocked';
  errorScope?: string;
  cancelTo?: string;
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
  const distanceKm = useWatch({ control: form.control, name: 'distance_km' });
  const sport = sports.find((candidate) => candidate.code === sportCode);
  const mode = sport?.distance_mode;
  const hasElevation = takesElevation(sport, distanceKm);
  // Hidden, it holds nothing: shown again, it opens empty. Only the user's
  // change of sport or distance hides it, and that change alone tells
  // whether the entry is changed: emptying it marks nothing.
  useEffect(() => {
    if (!hasElevation && form.getValues('elevation_m') !== '') {
      form.setValue('elevation_m', '');
      form.clearErrors('elevation_m');
    }
  }, [hasElevation, form]);

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
          : errorMessage(error, (candidate) => i18n.exists(candidate), errorScope)
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
  const elevationError = errors.elevation_m?.message;
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
                  {...register('start_date', { deps: [...CLOCK_PARTS] })}
                />
              </div>
              {/* Wider than the date: on a phone it goes under it, and it
                  shrinks to the screen when the text is enlarged. */}
              <div
                role="group"
                aria-labelledby="start_clock-label"
                className="min-w-0 grow basis-52"
              >
                <span id="start_clock-label" className="block font-semibold">
                  {t('activityForm.fields.startedAt.time')}
                </span>
                {/* An hour and minutes, on 24 hours: "8" is enough. A native
                    time field follows the browser's language (AM/PM in
                    English) and wants the minutes typed. Side by side, one
                    under the other when the text is enlarged. */}
                <div className="mt-2 flex flex-wrap gap-3">
                  {CLOCK_PARTS.map((part) => (
                    <div key={part} className="relative min-w-24 flex-1">
                      <label htmlFor={part} className="sr-only">
                        {t(CLOCK_LABELS[part])}
                      </label>
                      <input
                        id={part}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={2}
                        aria-invalid={startError ? true : undefined}
                        aria-describedby={describedBy('start', startError)}
                        className={`${inputClass} mt-0! h-13 w-full pr-14`}
                        {...register(part, {
                          // One error for the day and the time: each change checks it again.
                          deps: ['start_date', ...CLOCK_PARTS.filter((other) => other !== part)],
                        })}
                      />
                      <span aria-hidden="true" className={unitClass}>
                        {t(CLOCK_UNITS[part])}
                      </span>
                    </div>
                  ))}
                </div>
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

          {hasElevation && (
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <label htmlFor="elevation_m" className={legendClass}>
                  {t('activityForm.fields.elevation.label')}{' '}
                  <span className="sr-only">{t('activityForm.fields.elevation.unitLong')}</span>
                </label>
                <span id="elevation_m-tag" className="text-sm text-muted">
                  {t('activityForm.fields.elevation.tagOptional')}
                </span>
              </div>
              <div className="relative mt-3 lg:max-w-sm">
                <input
                  id="elevation_m"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-invalid={elevationError ? true : undefined}
                  aria-describedby={[
                    'elevation_m-tag',
                    ...(elevationError ? ['elevation_m-error'] : []),
                  ].join(' ')}
                  className={`${inputClass} mt-0! h-13 w-full pr-14`}
                  {...register('elevation_m')}
                />
                <span aria-hidden="true" className={unitClass}>
                  {t('activityForm.fields.elevation.unit')}
                </span>
              </div>
              <FieldError id="elevation_m-error" message={elevationError} />
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
              className="h-13 flex-1 rounded-full bg-accent hover-accent px-8 text-button font-bold text-on-accent disabled:opacity-60 md:flex-none"
            >
              {busy ? t(`${submitKey}.busy`) : t(`${submitKey}.label`)}
            </button>
            {/* A phone leaves by the arrow of the header. */}
            <Link
              to={cancelTo}
              className="hidden h-11 items-center font-semibold text-muted underline underline-offset-4 md:inline-flex hover-link"
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
