import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSports } from '../../../api/hooks/useSports';
import { ErrorState } from '../../../components/states/ErrorState';
import { LoadingState } from '../../../components/states/LoadingState';
import { factorSports } from '../../../domain/challengeCreate';
import { formatFactor, formatKm } from '../../../domain/format/distance';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { FieldError } from './FieldError';
import { describedBy, inputClass } from './fields';
import { useSportName } from './useSportName';

// X of the example while the field holds no valid increment.
const EXAMPLE_STEP_KM = 2;

/**
 * Step 3 of the creation: the 3 categories, always there. Only the increment
 * X of the run elimination and the distance factors (prefilled with the
 * catalogue's suggestions) are set here. `factorsWaiting`: Next was pressed
 * before the factors could be shown, which the step explains.
 */
export function CategoriesStep({ factorsWaiting }: { factorsWaiting: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const sports = useSports();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ChallengeCreateInput>();
  const stepKm = useWatch({ control, name: 'elimination_step_km' });
  const exampleKm = stepKm > 0 && stepKm <= 100 ? stepKm : EXAMPLE_STEP_KM;
  const stepError = errors.elimination_step_km?.message;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">{t('challengeCreate.categories.fixed')}</p>
      <ol className="flex flex-col gap-4">
        <li className="rounded-row border border-border bg-surface p-4">
          <h3 className="font-display font-bold">{t('challengeCreate.categories.time.name')}</h3>
          <p className="mt-1 text-sm text-muted">
            {t('challengeCreate.categories.time.explanation')}
          </p>
        </li>

        <li className="rounded-row border border-border bg-surface p-4">
          <h3 className="font-display font-bold">
            {t('challengeCreate.categories.distance.name')}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t('challengeCreate.categories.distance.explanation')}
          </p>
          {factorsWaiting && !sports.isSuccess && (
            <p role="alert" className="mt-3 text-sm text-risk-fg">
              {t('challengeCreate.fields.factors.waiting')}
            </p>
          )}
          {sports.isPending ? (
            <div className="mt-3">
              <LoadingState />
            </div>
          ) : sports.isError ? (
            <div className="mt-3">
              <ErrorState error={sports.error} onRetry={() => void sports.refetch()} />
            </div>
          ) : (
            <fieldset className="mt-4" aria-describedby="factors-hint">
              <legend className="text-sm font-semibold">
                {t('challengeCreate.fields.factors.label')}
              </legend>
              <p id="factors-hint" className="mt-1 text-sm text-muted">
                {t('challengeCreate.fields.factors.hint', { run: formatFactor(1, locale) })}
              </p>
              <ul className="mt-3 flex max-w-sm flex-col gap-3">
                {factorSports(sports.data).map(({ code, suggested_factor: suggested }) => {
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
                          // the catalogue's suggestion until the creator
                          // changes it.
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
                })}
              </ul>
            </fieldset>
          )}
        </li>

        <li className="rounded-row border border-border bg-surface p-4">
          <h3 className="font-display font-bold">
            {t('challengeCreate.categories.elimination.name')}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t('challengeCreate.categories.elimination.explanation')}
          </p>
          <div className="mt-4">
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
                ran2: formatKm(10, locale),
                week3: formatKm(10 + exampleKm, locale),
              })}
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
