import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useCreateActivity, type Activity } from '../../api/hooks/useActivities';
import type { Sport } from '../../api/hooks/useSports';
import { sortSportsByName } from '../../domain/challengeCreate';
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
import { useSportName } from '../challenges/create/useSportName';
import { ActivitySaved } from './ActivitySaved';
import { useActivityFormData } from './useActivityFormData';

const DURATION_PARTS = ['hours', 'minutes', 'seconds'] as const;
// Statuses of POST /activities that record nothing.
const REFUSED_FOR_GOOD = new Set([400, 404, 422]);

const EMPTY: ActivityCreateInput = {
  sport_code: '',
  sport_label: '',
  started_at: '',
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
 * The fields: a sport of the catalogue (or "other", with a free label), the
 * start, read in `timeZone` and said so, the duration (always) and the
 * distance, shown only when the sport has one: required, or optional for
 * "other". No speed: the API computes it. They open with `initialValues`;
 * `save` sends the request and throws the API's refusal, shown here: on the
 * refused fields, or above the button (`weekLockedKey` words a week that
 * has ended). `submitKey` holds the button's label and busy label.
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
  const sorted = sortSportsByName(sports, sportName, locale);
  const form = useForm<ActivityCreateInput, unknown, ActivityCreateValues>({
    resolver: zodResolver(activityCreateSchema(now, sports, timeZone)),
    // Checked once the field is left, then at each keystroke.
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: initialValues,
  });
  const {
    register,
    formState: { errors },
  } = form;
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
  const startError = errors.started_at?.message;
  const durationError = errors.hours?.message;
  const distanceError = errors.distance_km?.message;

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
      className="mt-6 flex max-w-md flex-col gap-6"
    >
      <div>
        <label htmlFor="sport_code" className="block text-sm font-semibold">
          {t('activityForm.fields.sport.label')}
        </label>
        <select
          id="sport_code"
          aria-invalid={sportError ? true : undefined}
          aria-describedby={sportError ? 'sport_code-error' : undefined}
          className={`${inputClass} h-11 w-full`}
          {...register('sport_code')}
        >
          <option value="" disabled>
            {t('activityForm.fields.sport.placeholder')}
          </option>
          {sorted.map(({ code }) => (
            <option key={code} value={code}>
              {code === 'other' ? t('activityForm.fields.sport.other') : sportName(code)}
            </option>
          ))}
        </select>
        <FieldError id="sport_code-error" message={sportError} />
      </div>

      {sportCode === 'other' && (
        <div>
          <label htmlFor="sport_label" className="block text-sm font-semibold">
            {t('activityForm.fields.sportLabel.label')}
          </label>
          <input
            id="sport_label"
            autoComplete="off"
            aria-invalid={labelError ? true : undefined}
            aria-describedby={describedBy('sport_label', labelError)}
            className={`${inputClass} h-11 w-full`}
            {...register('sport_label')}
          />
          <p id="sport_label-hint" className="mt-1 text-sm text-muted">
            {t('activityForm.fields.sportLabel.hint')}
          </p>
          <FieldError id="sport_label-error" message={labelError} />
        </div>
      )}

      <div>
        <label htmlFor="started_at" className="block text-sm font-semibold">
          {t('activityForm.fields.startedAt.label')}
        </label>
        <input
          id="started_at"
          type="datetime-local"
          // The time there now: the schema checks it again at sending.
          max={toZonedDateTime(now(), timeZone)}
          aria-invalid={startError ? true : undefined}
          aria-describedby={describedBy('started_at', startError)}
          className={`${inputClass} h-11 w-full`}
          {...register('started_at')}
        />
        <p id="started_at-hint" className="mt-1 text-sm text-muted">
          {t('activityForm.fields.startedAt.hint', { zone: timeZoneName(timeZone, locale) })}
        </p>
        <FieldError id="started_at-error" message={startError} />
      </div>

      <fieldset aria-describedby={describedBy('duration', durationError)}>
        <legend className="text-sm font-semibold">{t('activityForm.fields.duration.label')}</legend>
        {/* Side by side, one under the other when the text is enlarged. */}
        <div className="mt-2 flex flex-wrap gap-3">
          {DURATION_PARTS.map((part) => (
            <div key={part} className="min-w-fit flex-1">
              <label htmlFor={part} className="block text-sm text-muted">
                {t(`activityForm.fields.duration.${part}`)}
              </label>
              <input
                id={part}
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={durationError ? true : undefined}
                aria-describedby={describedBy('duration', durationError)}
                className={`${inputClass} h-11 w-full`}
                {...register(part, {
                  // One error for the three parts: each change checks it again.
                  deps: DURATION_PARTS.filter((other) => other !== part),
                })}
              />
            </div>
          ))}
        </div>
        <p id="duration-hint" className="mt-1 text-sm text-muted">
          {t('activityForm.fields.duration.hint')}
        </p>
        <FieldError id="duration-error" message={durationError} />
      </fieldset>

      {(mode === 'required' || mode === 'optional') && (
        <div>
          <label htmlFor="distance_km" className="block text-sm font-semibold">
            {t('activityForm.fields.distance.label')}
          </label>
          <input
            id="distance_km"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={distanceError ? true : undefined}
            aria-describedby={describedBy('distance_km', distanceError)}
            className={`${inputClass} h-11 w-full`}
            {...register('distance_km')}
          />
          <p id="distance_km-hint" className="mt-1 text-sm text-muted">
            {t(
              mode === 'required'
                ? 'activityForm.fields.distance.hintRequired'
                : 'activityForm.fields.distance.hintOptional',
            )}
          </p>
          <FieldError id="distance_km-error" message={distanceError} />
        </div>
      )}

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
      <button
        type="submit"
        disabled={busy}
        className="h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent disabled:opacity-60"
      >
        {busy ? t(`${submitKey}.busy`) : t(`${submitKey}.label`)}
      </button>
    </form>
  );
}
