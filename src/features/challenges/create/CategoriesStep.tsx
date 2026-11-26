import type { LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useSports } from '../../../api/hooks/useSports';
import { ErrorState } from '../../../components/states/ErrorState';
import { LoadingState } from '../../../components/states/LoadingState';
import {
  factorSports,
  rebaseFactors,
  referenceSports,
  sortSportsByName,
  usesDistanceFactors,
} from '../../../domain/challengeCreate';
import { formatFactor, formatKm } from '../../../domain/format/distance';
import { POINTS_CRITERIA, type ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { CATEGORY_ICONS } from '../detail/categoryIcons';
import { ChangedPill } from './ChangedPill';
import { FieldError } from './FieldError';
import { choiceCardClass, describedBy, inputClass } from './fields';
import { Switch } from './Switch';
import { useSportName } from './useSportName';

// X of the example while the field holds no valid increment.
const EXAMPLE_STEP_KM = 2;
// The example's week 1, then how far above the minimum week 2 goes: more
// than the minimum, the new base (5 km, then 10 km when X = 2, as in the
// README). Example figures, not a rule.
const EXAMPLE_WEEK1_KM = 5;
const EXAMPLE_ABOVE_MINIMUM_KM = 3;

/**
 * Step 3 of the creation: the reference sport, then the categories, one card
 * each. The cumulative time is always there; the others are switched on at
 * will, their settings inside their card: the elimination's weekly increase,
 * the points' criteria and scale (the cumulative distance and the total
 * elevation gain have none). The
 * distance factors show once the cumulative distance or the longest session
 * by distance is chosen: the catalogue's suggestions brought back to the
 * reference, which follow it when it changes unless the creator set them.
 * `sportsWaiting`: Next was pressed before the sports could be shown, which
 * the step explains.
 */
export function CategoriesStep({ sportsWaiting }: { sportsWaiting: boolean }) {
  const { t } = useTranslation();
  const sports = useSports();

  return (
    <div className="flex flex-col gap-8">
      {sportsWaiting && !sports.data && (
        <p role="alert" className="text-sm text-risk-fg">
          {t('challengeCreate.categories.waiting')}
        </p>
      )}
      {sports.isPending ? (
        <LoadingState />
      ) : sports.data ? (
        // A failed refresh keeps the catalogue: the global banner says so.
        <Categories sports={sports.data} />
      ) : (
        <ErrorState error={sports.error} onRetry={() => void sports.refetch()} />
      )}
    </div>
  );
}

type Sports = NonNullable<ReturnType<typeof useSports>['data']>;

// The form's field of each category the creator switches on.
type CategoryToggle = 'cumulative_distance' | 'elimination' | 'points' | 'cumulative_elevation';

/**
 * A category's card: icon, name, what it ranks, then on the right its switch
 * (`toggle`, the form's field) or what stands in for it (`fixed`). Its
 * settings show inside once it is on; a switch the server refused, below.
 */
function CategoryCard({
  id,
  Icon,
  name,
  explanation,
  toggle,
  fixed,
  on,
  children,
}: {
  id: string;
  Icon: LucideIcon;
  name: string;
  explanation: string;
  toggle?: CategoryToggle;
  fixed?: ReactNode;
  on: boolean;
  children?: ReactNode;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ChallengeCreateInput>();
  const toggleError = toggle && errors[toggle]?.message;
  const head = (
    <>
      <span
        aria-hidden="true"
        className="flex size-11 flex-none items-center justify-center rounded-row bg-accent-soft text-accent"
      >
        <Icon size={20} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        {/* A heading, though in a label, which takes no h3. */}
        <span
          id={`${id}-name`}
          role="heading"
          aria-level={3}
          className="block font-display text-lg font-bold"
        >
          {name}
        </span>
        <span id={`${id}-explanation`} className="mt-1 block text-muted">
          {explanation}
        </span>
        {toggle && <ChangedPill field={toggle} className="mt-2" />}
      </span>
    </>
  );

  return (
    <li
      className={`rounded-card border bg-surface p-4 ${on ? 'border-accent ring-1 ring-accent' : 'border-border'}`}
    >
      {toggle ? (
        // The whole head switches the category: bigger than the switch.
        <label className="flex cursor-pointer items-start gap-3">
          {head}
          <Switch
            aria-labelledby={`${id}-name`}
            aria-describedby={
              toggleError ? `${id}-explanation ${toggle}-error` : `${id}-explanation`
            }
            aria-invalid={toggleError ? true : undefined}
            {...register(toggle)}
          />
        </label>
      ) : (
        <div className="flex items-start gap-3">
          {head}
          {fixed}
        </div>
      )}
      {toggle && <FieldError id={`${toggle}-error`} message={toggleError} />}
      {on && children && (
        <div className="mt-4 flex flex-col gap-6 border-t border-border pt-4">{children}</div>
      )}
    </li>
  );
}

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
  const [reference, distance, elimination, stepKm, points, criteria, elevation] = useWatch({
    control,
    name: [
      'reference_sport',
      'cumulative_distance',
      'elimination',
      'elimination_step_km',
      'points',
      'points_criteria',
      'cumulative_elevation',
    ],
  });
  const exampleKm = stepKm !== undefined && stepKm > 0 && stepKm <= 100 ? stepKm : EXAMPLE_STEP_KM;
  const week2DoneKm = EXAMPLE_WEEK1_KM + exampleKm + EXAMPLE_ABOVE_MINIMUM_KM;
  const examples = [
    { week: 1, done: EXAMPLE_WEEK1_KM, needed: EXAMPLE_WEEK1_KM + exampleKm },
    { week: 2, done: week2DoneKm, needed: week2DoneKm + exampleKm },
  ];
  const referenceError = errors.reference_sport?.message;
  const stepError = errors.elimination_step_km?.message;
  const criteriaError = errors.points_criteria?.message;
  // The criteria that do not use the equivalent distance say how they count.
  const criteriaHints = [
    criteria.includes('weekly_elevation') && 'weeklyElevation',
    criteria.includes('fastest_run') && 'fastestRun',
  ].filter((hint) => hint !== false);
  const criteriaHint = criteriaHints.length > 0;
  const criteriaDescribedBy =
    [criteriaHint && 'points_criteria-hint', criteriaError && 'points_criteria-error']
      .filter(Boolean)
      .join(' ') || undefined;
  const podiumError = errors.points_podium?.message;
  const minSessionError = errors.points_min_session_minutes?.message;

  return (
    <>
      <div>
        <label htmlFor="reference_sport" className="block font-semibold">
          {t('challengeCreate.fields.referenceSport.label')}
        </label>
        <select
          id="reference_sport"
          aria-invalid={referenceError ? true : undefined}
          aria-describedby={describedBy('reference_sport', referenceError)}
          className={`${inputClass} h-13 w-full`}
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
        <p id="reference_sport-hint" className="mt-2 text-sm text-muted">
          {t('challengeCreate.fields.referenceSport.hint')}
        </p>
        <FieldError id="reference_sport-error" message={referenceError} />
        <ChangedPill field="reference_sport" className="mt-2" />
      </div>

      <section aria-labelledby="categories-title">
        <h3 id="categories-title" className="font-display text-lg font-bold">
          {t('challengeCreate.categories.title')}
        </h3>
        <p className="mt-1 text-muted">{t('challengeCreate.categories.intro')}</p>

        <ol className="mt-4 flex flex-col gap-4">
          <CategoryCard
            id="time"
            Icon={CATEGORY_ICONS.cumulative_time}
            name={t('challengeCreate.categories.time.name')}
            explanation={t('challengeCreate.categories.time.explanation')}
            fixed={
              <span className="flex-none rounded-full bg-segment px-3 py-1 text-sm font-semibold text-muted">
                {t('challengeCreate.categories.time.always')}
              </span>
            }
            on
          />

          <CategoryCard
            id="distance"
            Icon={CATEGORY_ICONS.cumulative_distance}
            name={t('challengeCreate.categories.distance.name')}
            explanation={t('challengeCreate.categories.distance.explanation')}
            toggle="cumulative_distance"
            on={distance}
          />

          <CategoryCard
            id="elimination"
            Icon={CATEGORY_ICONS.elimination}
            name={t('challengeDetail.categories.elimination', {
              sport: sportName(reference),
            })}
            explanation={t('challengeCreate.categories.elimination.explanation', {
              sport: sportName(reference),
            })}
            toggle="elimination"
            on={elimination}
          >
            <div>
              <label htmlFor="elimination_step_km" className="block font-semibold">
                {t('challengeCreate.fields.eliminationStep.label')}{' '}
                <span className="sr-only">
                  {t('challengeCreate.fields.eliminationStep.unitLong')}
                </span>
              </label>
              <span className="relative mt-2 block w-40">
                <input
                  id="elimination_step_km"
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  max={100}
                  step={0.1}
                  aria-invalid={stepError ? true : undefined}
                  aria-describedby={`${describedBy('elimination_step_km', stepError)} elimination-example`}
                  className={`${inputClass} mt-0! h-13 w-full pr-12`}
                  {...register('elimination_step_km', { valueAsNumber: true })}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-semibold text-muted"
                >
                  {t('challengeCreate.fields.eliminationStep.unit')}
                </span>
              </span>
              <p id="elimination_step_km-hint" className="mt-2 text-sm text-muted">
                {t('challengeCreate.fields.eliminationStep.hint')}
              </p>
              <FieldError id="elimination_step_km-error" message={stepError} />
              <ChangedPill field="elimination_step_km" className="mt-2" />
            </div>
            <div id="elimination-example" className="rounded-row bg-bg p-4">
              <p className="text-xs font-bold tracking-[0.6px] text-muted uppercase">
                {t('challengeCreate.categories.elimination.exampleTitle')}
              </p>
              {examples.map(({ week, done, needed }) => (
                <p key={week} className="mt-1">
                  <Trans
                    i18nKey="challengeCreate.categories.elimination.example"
                    values={{
                      done: formatKm(done, locale),
                      week,
                      needed: formatKm(needed, locale),
                      next: week + 1,
                    }}
                    components={{ b: <strong /> }}
                  />
                </p>
              ))}
            </div>
          </CategoryCard>

          <CategoryCard
            id="points"
            Icon={CATEGORY_ICONS.points}
            name={t('challengeDetail.categories.points')}
            explanation={t('challengeCreate.categories.points.explanation')}
            toggle="points"
            on={points}
          >
            <fieldset aria-describedby={criteriaDescribedBy}>
              <legend className="font-semibold">
                {t('challengeCreate.fields.pointsCriteria.label')}
              </legend>
              <FieldError id="points_criteria-error" message={criteriaError} />
              <div className="mt-3 flex flex-wrap gap-2">
                {POINTS_CRITERIA.map((criterion) => (
                  <label
                    key={criterion}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 font-semibold hover-choice has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:ring-1 has-[:checked]:ring-accent"
                  >
                    <input
                      type="checkbox"
                      value={criterion}
                      aria-invalid={criteriaError ? true : undefined}
                      className="size-5 flex-none accent-accent"
                      {...register('points_criteria')}
                    />
                    {t(`challengeDetail.categories.pointsParams.criteria.${criterion}`)}
                  </label>
                ))}
              </div>
              {criteriaHint && (
                <div id="points_criteria-hint" className="mt-2 space-y-1 text-sm text-muted">
                  {criteriaHints.map((hint) => (
                    <p key={hint}>{t(`challengeDetail.categories.pointsParams.${hint}`)}</p>
                  ))}
                </div>
              )}
              <ChangedPill field="points_criteria" className="mt-2" />
            </fieldset>
            {criteria.includes('session_count') && (
              <div>
                <label htmlFor="points_min_session_minutes" className="block font-semibold">
                  {t('challengeCreate.fields.minSession.label')}
                </label>
                <input
                  id="points_min_session_minutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={180}
                  step={1}
                  aria-invalid={minSessionError ? true : undefined}
                  aria-describedby={describedBy('points_min_session_minutes', minSessionError)}
                  className={`${inputClass} block h-13 w-28`}
                  {...register('points_min_session_minutes', { valueAsNumber: true })}
                />
                <p id="points_min_session_minutes-hint" className="mt-2 text-sm text-muted">
                  {t('challengeCreate.fields.minSession.hint')}
                </p>
                <FieldError id="points_min_session_minutes-error" message={minSessionError} />
                <ChangedPill field="points_min_session_minutes" className="mt-2" />
              </div>
            )}
            <fieldset aria-describedby={podiumError ? 'points_podium-error' : undefined}>
              <legend className="font-semibold">
                {t('challengeCreate.fields.pointsPodium.label')}
              </legend>
              <FieldError id="points_podium-error" message={podiumError} />
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {(['5', '10'] as const).map((podium) => (
                  <label key={podium} className={choiceCardClass}>
                    <input
                      type="radio"
                      value={podium}
                      aria-invalid={podiumError ? true : undefined}
                      aria-labelledby={`podium-${podium}-label`}
                      aria-describedby={`podium-${podium}-points`}
                      className="mt-0.5 size-5 flex-none accent-accent"
                      {...register('points_podium')}
                    />
                    <span>
                      <span id={`podium-${podium}-label`} className="block font-bold">
                        {t(`challengeCreate.fields.pointsPodium.name_${podium}`)}
                      </span>
                      <span
                        id={`podium-${podium}-points`}
                        className="mt-1 block text-sm text-muted"
                      >
                        {t(`challengeCreate.fields.pointsPodium.points_${podium}`)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <ChangedPill field="points_podium" className="mt-2" />
            </fieldset>
          </CategoryCard>

          <CategoryCard
            id="elevation"
            Icon={CATEGORY_ICONS.cumulative_elevation}
            name={t('challengeCreate.categories.elevation.name')}
            explanation={t('challengeCreate.categories.elevation.explanation')}
            toggle="cumulative_elevation"
            on={elevation}
          />
        </ol>
      </section>

      {usesDistanceFactors({
        cumulative_distance: distance,
        points,
        points_criteria: criteria,
      }) && <DistanceFactors sports={sports} reference={reference} />}
    </>
  );
}

/**
 * The distance factors, for every category that uses them: the reference
 * counts ×1, the other distance sports start at their suggestion. Shown as
 * pills, until the creator asks to customize them (or the server refused
 * one, which then needs its field).
 */
function DistanceFactors({ sports, reference }: { sports: Sports; reference: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const [customizing, setCustomizing] = useState(false);
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ChallengeCreateInput>();
  const factors = useWatch({ control, name: 'factors' });
  // Refused as a whole by the server. Typed as a sport's error too, the
  // factors being keyed by code.
  const factorsMessage = errors.factors?.message;
  const factorsError = typeof factorsMessage === 'string' ? factorsMessage : undefined;
  const open = customizing || errors.factors !== undefined;
  const others = sortSportsByName(factorSports(sports, reference), sportName, locale);
  const referencePill = t('challengeCreate.recap.referenceFactor', {
    sport: sportName(reference),
    factor: formatFactor(1, locale),
  });

  return (
    <section aria-labelledby="factors-title" className="rounded-card border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 id="factors-title" className="font-display text-lg font-bold">
          {t('challengeCreate.fields.factors.label')}
        </h3>
        {!open && (
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            aria-describedby="factors-title"
            className="-my-2 inline-flex h-11 flex-none items-center font-semibold text-accent underline underline-offset-4 hover-link"
          >
            {t('challengeCreate.fields.factors.customize')}
          </button>
        )}
      </div>
      <p className="mt-2 text-muted">{t('challengeCreate.fields.factors.intro')}</p>
      <ChangedPill field="factors" className="mt-2" />

      {open ? (
        <fieldset
          aria-labelledby="factors-title"
          aria-describedby={factorsError ? 'factors-hint factors-error' : 'factors-hint'}
          className="mt-4"
        >
          <p id="factors-hint" className="text-sm text-muted">
            {t('challengeCreate.fields.factors.hint')}
          </p>
          <FieldError id="factors-error" message={factorsError} />
          <ul className="mt-3 flex max-w-sm flex-col gap-3">
            <li className="flex min-h-11 items-center font-semibold">{referencePill}</li>
            {others.map(({ code, suggested }) => {
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
                      defaultValue={factors[code] ?? suggested}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={describedBy(id, error)}
                      className={`${inputClass} mt-0! h-11 w-24 flex-none text-right`}
                      {...register(`factors.${code}`, { valueAsNumber: true })}
                    />
                  </div>
                  <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
                    {t('challengeCreate.fields.factors.suggested', {
                      factor: formatFactor(suggested, locale),
                    })}
                  </p>
                  <FieldError id={`${id}-error`} message={error} />
                  <ChangedPill field={`factors.${code}`} className="mt-1" />
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
          <li className="rounded-full bg-accent px-3 py-1 text-on-accent">{referencePill}</li>
          {others.map(({ code, suggested }) => (
            <li key={code} className="rounded-full bg-segment px-3 py-1">
              {`${sportName(code)} ${formatFactor(factors[code] ?? suggested, locale)}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
