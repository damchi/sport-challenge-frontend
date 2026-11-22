import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSports } from '../../../api/hooks/useSports';
import { ErrorState } from '../../../components/states/ErrorState';
import { LoadingState } from '../../../components/states/LoadingState';
import {
  factorSports,
  rebaseFactors,
  referenceSports,
  sortSportsByName,
} from '../../../domain/challengeCreate';
import { formatFactor, formatKm } from '../../../domain/format/distance';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { FieldError } from './FieldError';
import { describedBy, inputClass } from './fields';
import { useSportName } from './useSportName';

// X of the example while the field holds no valid increment.
const EXAMPLE_STEP_KM = 2;

/**
 * Step 3 of the creation: the reference sport, then the categories. The
 * cumulative time is always there; the cumulative distance, with its
 * factors, and the elimination, with its increment X, are added at will.
 * The factors start at the catalogue's suggestions brought back to the
 * reference, and follow it when it changes, unless the creator set them.
 * `sportsWaiting`: Next was pressed before the sports could be shown, which
 * the step explains.
 */
export function CategoriesStep({ sportsWaiting }: { sportsWaiting: boolean }) {
  const { t } = useTranslation();
  const sports = useSports();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">{t('challengeCreate.categories.intro')}</p>
      {sportsWaiting && !sports.isSuccess && (
        <p role="alert" className="text-sm text-risk-fg">
          {t('challengeCreate.categories.waiting')}
        </p>
      )}
      {sports.isPending ? (
        <LoadingState />
      ) : sports.isError ? (
        <ErrorState error={sports.error} onRetry={() => void sports.refetch()} />
      ) : (
        <Categories sports={sports.data} />
      )}
    </div>
  );
}

type Sports = NonNullable<ReturnType<typeof useSports>['data']>;

function Categories({ sports }: { sports: Sports }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const {
    register,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<ChallengeCreateInput>();
  const [reference, distance, elimination, stepKm] = useWatch({
    control,
    name: ['reference_sport', 'cumulative_distance', 'elimination', 'elimination_step_km'],
  });
  const exampleKm = stepKm !== undefined && stepKm > 0 && stepKm <= 100 ? stepKm : EXAMPLE_STEP_KM;
  const referenceError = errors.reference_sport?.message;
  const stepError = errors.elimination_step_km?.message;
  // Refused as a whole by the server. Typed as a sport's error too, the
  // factors being keyed by code.
  const factorsMessage = errors.factors?.message;
  const factorsError = typeof factorsMessage === 'string' ? factorsMessage : undefined;

  return (
    <>
      <div>
        <label htmlFor="reference_sport" className="block text-sm font-semibold">
          {t('challengeCreate.fields.referenceSport.label')}
        </label>
        <select
          id="reference_sport"
          aria-invalid={referenceError ? true : undefined}
          aria-describedby={describedBy('reference_sport', referenceError)}
          className={`${inputClass} h-11 w-full`}
          {...register('reference_sport', {
            // The suggestions follow the reference; a factor the creator
            // set stays as is.
            onChange: (event: { target: { value: string } }) => {
              const changes = rebaseFactors(
                getValues('factors'),
                sports,
                reference,
                event.target.value,
              );
              for (const [code, factor] of Object.entries(changes)) {
                setValue(`factors.${code}`, factor);
              }
            },
          })}
        >
          {sortSportsByName(referenceSports(sports), sportName, locale).map(({ code }) => (
            <option key={code} value={code}>
              {sportName(code)}
            </option>
          ))}
        </select>
        <p id="reference_sport-hint" className="mt-1 text-sm text-muted">
          {t('challengeCreate.fields.referenceSport.hint')}
        </p>
        <FieldError id="reference_sport-error" message={referenceError} />
      </div>

      <ol className="flex flex-col gap-4">
        <li className="rounded-row border border-border bg-surface p-4">
          <h3 className="font-display font-bold">{t('challengeCreate.categories.time.name')}</h3>
          <p className="mt-1 text-sm font-semibold">
            {t('challengeCreate.categories.time.always')}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t('challengeCreate.categories.time.explanation')}
          </p>
        </li>

        <li className="rounded-row border border-border bg-surface p-4">
          <h3 className="font-display font-bold">
            {t('challengeCreate.categories.distance.name')}
          </h3>
          <p id="distance-explanation" className="mt-1 text-sm text-muted">
            {t('challengeCreate.categories.distance.explanation')}
          </p>
          <label className="mt-2 flex min-h-11 items-center gap-3 font-semibold">
            <input
              type="checkbox"
              aria-describedby="distance-explanation"
              {...register('cumulative_distance')}
            />
            {t('challengeCreate.categories.distance.add')}
          </label>
          {distance && (
            <fieldset className="mt-2" aria-describedby="factors-hint">
              <legend className="text-sm font-semibold">
                {t('challengeCreate.fields.factors.label')}
              </legend>
              <p id="factors-hint" className="mt-1 text-sm text-muted">
                {t('challengeCreate.fields.factors.hint')}
              </p>
              <FieldError id="factors-error" message={factorsError} />
              <ul className="mt-3 flex max-w-sm flex-col gap-3">
                <li className="flex min-h-11 items-center">
                  {t('challengeCreate.recap.referenceFactor', {
                    sport: sportName(reference),
                    factor: formatFactor(1, locale),
                  })}
                </li>
                {sortSportsByName(factorSports(sports, reference), sportName, locale).map(
                  ({ code, suggested }) => {
                    const id = `factor-${code}`;
                    const error = errors.factors?.[code]?.message;
                    return (
                      <li key={code}>
                        <div className="flex items-center gap-3">
                          <label htmlFor={id} className="min-w-0 flex-1">
                            {sportName(code)}
                          </label>
                          <input
                            id={id}
                            type="number"
                            inputMode="decimal"
                            min={0.1}
                            max={2}
                            step={0.01}
                            // Read by the form when the field first registers:
                            // the suggestion until the creator changes it.
                            defaultValue={suggested}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={describedBy(id, error)}
                            className={`${inputClass} mt-0 h-11 w-24 flex-none text-right`}
                            {...register(`factors.${code}`, { valueAsNumber: true })}
                          />
                        </div>
                        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
                          {t('challengeCreate.fields.factors.suggested', {
                            factor: formatFactor(suggested, locale),
                          })}
                        </p>
                        <FieldError id={`${id}-error`} message={error} />
                      </li>
                    );
                  },
                )}
              </ul>
            </fieldset>
          )}
        </li>

        <li className="rounded-row border border-border bg-surface p-4">
          <h3 className="font-display font-bold">
            {t('challengeDetail.categories.elimination', { sport: sportName(reference) })}
          </h3>
          <p id="elimination-explanation" className="mt-1 text-sm text-muted">
            {t('challengeCreate.categories.elimination.explanation', {
              sport: sportName(reference),
            })}
          </p>
          <label className="mt-2 flex min-h-11 items-center gap-3 font-semibold">
            <input
              type="checkbox"
              aria-describedby="elimination-explanation"
              {...register('elimination')}
            />
            {t('challengeCreate.categories.elimination.add')}
          </label>
          {elimination && (
            <div className="mt-2">
              <label htmlFor="elimination_step_km" className="block text-sm font-semibold">
                {t('challengeCreate.fields.eliminationStep.label')}
              </label>
              <input
                id="elimination_step_km"
                type="number"
                inputMode="decimal"
                min={0.1}
                max={100}
                step={0.1}
                aria-invalid={stepError ? true : undefined}
                aria-describedby={`${describedBy('elimination_step_km', stepError)} elimination-example`}
                className={`${inputClass} block h-11 w-32`}
                {...register('elimination_step_km', { valueAsNumber: true })}
              />
              <p id="elimination_step_km-hint" className="mt-1 text-sm text-muted">
                {t('challengeCreate.fields.eliminationStep.hint')}
              </p>
              <FieldError id="elimination_step_km-error" message={stepError} />
              <p id="elimination-example" className="mt-2 text-sm">
                {t('challengeCreate.categories.elimination.example', {
                  step: formatKm(exampleKm, locale),
                  week1: formatKm(5, locale),
                  week2: formatKm(5 + exampleKm, locale),
                  // 3 km above the minimum: the new base, whatever X.
                  ran2: formatKm(5 + exampleKm + 3, locale),
                  week3: formatKm(5 + exampleKm + 3 + exampleKm, locale),
                })}
              </p>
            </div>
          )}
        </li>
      </ol>
    </>
  );
}
