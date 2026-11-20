import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError, errorMessage } from '../../api/errors';
import { useCreateActivity } from '../../api/hooks/useActivities';
import { useChallenges } from '../../api/hooks/useChallenges';
import { useSports, type Sport } from '../../api/hooks/useSports';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { activityTimeZone } from '../../domain/activity';
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

const DURATION_PARTS = ['hours', 'minutes', 'seconds'] as const;
// Statuses of POST /activities that record nothing.
const REFUSED_FOR_GOOD = new Set([400, 404, 422]);

/**
 * Entry of an activity, once the catalogue of sports and the user's ongoing
 * challenges are loaded: the start is read in their time zone when they
 * share one, in the device's otherwise. Tests give `now`, the device's time
 * zone and the maker of idempotency keys.
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
  const sports = useSports();
  const ongoing = useChallenges('mine', 'ongoing');
  // Every page: a zone missed would read the start in the wrong one.
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = ongoing;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  if (sports.isPending || ongoing.isPending || (hasNextPage && !isError)) {
    return <LoadingState />;
  }
  if (!sports.data || !ongoing.data || ongoing.isError) {
    return (
      <ErrorState
        error={sports.error ?? ongoing.error}
        onRetry={() => {
          if (sports.isError) void sports.refetch();
          if (ongoing.isError) void ongoing.refetch();
        }}
      />
    );
  }
  const timeZone = activityTimeZone(
    ongoing.data.pages.flatMap((page) => page.items),
    deviceTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  return (
    <ActivityFormFields
      sports={sports.data}
      timeZone={timeZone}
      now={now ?? (() => new Date())}
      newIdempotencyKey={newIdempotencyKey ?? (() => crypto.randomUUID())}
    />
  );
}

/**
 * The fields: a sport of the catalogue (or "other", with a free label), the
 * start, read in `timeZone` and said so, the duration (always) and the
 * distance, shown only when the sport
 * has one: required, or optional for "other". No speed: the API computes it.
 * The idempotency key is chosen when the form opens and goes with every
 * attempt that may have been recorded; a refused one gets a new key. Once
 * recorded, the form gives way to the outcome.
 */
function ActivityFormFields({
  sports,
  timeZone,
  now,
  newIdempotencyKey,
}: {
  sports: readonly Sport[];
  timeZone: string;
  now: () => Date;
  newIdempotencyKey: () => string;
}) {
  const { t, i18n } = useTranslation();
  const sportName = useSportName();
  const createActivity = useCreateActivity();
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [submitError, setSubmitError] = useState<string>();
  const [saved, setSaved] = useState(false);
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
    defaultValues: {
      sport_code: '',
      sport_label: '',
      started_at: '',
      hours: '',
      minutes: '',
      seconds: '',
      distance_km: '',
    },
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
        ? errorMessage(error, (candidate) => i18n.exists(candidate))
        : { key: 'errors.unknown', values: {} };
    setSubmitError(t(key, values));
    // Said where the eye is: the message may be off screen on a phone.
    focusError.current = true;
  };

  const record = async (activity: ActivityCreateValues) => {
    if (sending.current) return;
    sending.current = true;
    setSubmitError(undefined);
    try {
      await createActivity.mutateAsync({ activity, idempotencyKey });
      setSaved(true);
    } catch (error) {
      // Refused for good by the contract (400, 404, 422): nothing was
      // recorded, the corrected entry goes with a new key. Otherwise (no
      // answer, server error, timeout) it may have been: the same key comes
      // again, so nothing is recorded twice.
      if (error instanceof ApiError && REFUSED_FOR_GOOD.has(error.status)) {
        setIdempotencyKey(newIdempotencyKey());
      }
      showError(error);
      sending.current = false;
    }
  };

  if (saved) {
    return (
      <div className="mt-6 flex flex-col items-start gap-4">
        <p ref={(element) => element?.focus()} tabIndex={-1} role="status" className="font-bold">
          {t('activityForm.saved')}
        </p>
        <Link
          to="/activities"
          className="inline-flex h-11 items-center font-semibold text-accent underline"
        >
          {t('activityForm.back')}
        </Link>
      </div>
    );
  }

  const sportError = errors.sport_code?.message;
  const labelError = errors.sport_label?.message;
  const startError = errors.started_at?.message;
  const durationError = errors.hours?.message;
  const distanceError = errors.distance_km?.message;
  const busy = createActivity.isPending;

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit(record)(event)}
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
        <div className="mt-2 flex gap-3">
          {DURATION_PARTS.map((part) => (
            <div key={part} className="flex-1">
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
        {busy ? t('activityForm.submit.busy') : t('activityForm.submit.label')}
      </button>
    </form>
  );
}
