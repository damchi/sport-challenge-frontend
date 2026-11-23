import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSports } from '../../../api/hooks/useSports';
import {
  factorSports,
  sortSportsByName,
  usesDistanceFactors,
} from '../../../domain/challengeCreate';
import { timeZoneName } from '../../../domain/format/challengeDates';
import { formatFactor, formatKm } from '../../../domain/format/distance';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { timeZoneCity } from '../../../domain/timeZones';
import { useSportName } from './useSportName';
import { windowPreview } from './windowPreview';

/** One line of the recap: what it is, its value, then a detail if any. */
function Row({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="border-t border-border py-3 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] md:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 min-w-0 break-words md:mt-0">
        <span className="block font-bold">{value}</span>
        {detail && <span className="mt-0.5 block text-sm text-muted">{detail}</span>}
      </dd>
    </div>
  );
}

/** A part of the recap, with its way back to the step that enters it. */
function Section({
  id,
  title,
  onEdit,
  children,
}: {
  id: string;
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby={id} className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3 pb-1">
        <h3 id={id} className="font-display text-lg font-bold">
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('challengeCreate.recap.editSection', { section: title })}
          className="inline-flex h-11 items-center font-semibold text-accent underline underline-offset-4"
        >
          {t('challengeCreate.recap.edit')}
        </button>
      </div>
      <dl>{children}</dl>
    </section>
  );
}

// Step of each part of the recap, for "Modifier".
const INFO_STEP = 0;
const DATES_STEP = 1;
const CATEGORIES_STEP = 2;

/**
 * Step 4 of the creation: everything entered, by part, each with a way back
 * to its step, then the warning that the categories are final. `error` is
 * the sending's, if any; `goTo` opens a step.
 */
export function RecapStep({
  now,
  error,
  goTo,
}: {
  now: Date;
  error: string | undefined;
  goTo: (step: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const sports = useSports();
  // The steps before were checked: the values are valid.
  const values = useFormContext<ChallengeCreateInput>().getValues();
  const period = windowPreview(values.start_date, values.weeks, values.timezone, now, locale);
  const reference = values.reference_sport;
  const factors = sortSportsByName(
    factorSports(sports.data ?? [], reference),
    sportName,
    locale,
  ).map(({ code, suggested }) => ({
    text: `${sportName(code)} ${formatFactor(values.factors[code] ?? suggested, locale)}`,
    changed: values.factors[code] !== undefined && values.factors[code] !== suggested,
  }));
  const zone = timeZoneName(values.timezone, locale);
  const criteria = values.points_criteria
    .map((criterion) => t(`challengeCreate.recap.criteriaNames.${criterion}`))
    .join(', ');
  // A failed sending disables then frees the button: the focus goes to the
  // error, so the keyboard is not lost.
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <div className="flex flex-col gap-4">
      <Section
        id="recap-info"
        title={t('challengeCreate.recap.sections.info')}
        onEdit={() => goTo(INFO_STEP)}
      >
        <Row label={t('challengeCreate.fields.title.label')} value={values.title.trim()} />
        {values.description !== '' && (
          <Row
            label={t('challengeCreate.recap.description')}
            value={<span className="font-normal whitespace-pre-line">{values.description}</span>}
          />
        )}
        <Row
          label={t('challengeCreate.recap.visibility')}
          value={t(`challengeCreate.fields.visibility.${values.visibility}`)}
          detail={t(`challengeCreate.recap.${values.visibility}Detail`)}
        />
        <Row
          label={t('challengeCreate.recap.invitations')}
          value={t(
            values.members_can_invite
              ? 'challengeCreate.recap.allInvite'
              : 'challengeCreate.recap.creatorsOnly',
          )}
        />
      </Section>

      <Section
        id="recap-dates"
        title={t('challengeCreate.recap.sections.dates')}
        onEdit={() => goTo(DATES_STEP)}
      >
        <Row
          label={t('challengeCreate.recap.period')}
          value={
            period &&
            t('challengeCreate.preview.period', {
              start: period.short.start,
              end: period.short.end,
              weeks: t('challengeCreate.preview.weeks', { count: values.weeks }),
            })
          }
          detail={
            period &&
            t('challengeCreate.recap.periodDetail', {
              start: period.full.start,
              end: period.full.end,
            })
          }
        />
        <Row
          label={t('challengeCreate.recap.timezone')}
          value={zone.charAt(0).toLocaleUpperCase(locale) + zone.slice(1)}
          detail={timeZoneCity(values.timezone)}
        />
      </Section>

      <Section
        id="recap-categories"
        title={t('challengeCreate.recap.sections.categories')}
        onEdit={() => goTo(CATEGORIES_STEP)}
      >
        <Row
          label={t('challengeCreate.fields.referenceSport.label')}
          value={sportName(reference)}
        />
        <Row
          label={t('challengeCreate.categories.time.name')}
          value={t('challengeCreate.recap.included')}
          detail={t('challengeCreate.recap.timeDetail')}
        />
        <Row
          label={t('challengeCreate.categories.distance.name')}
          value={t(
            values.cumulative_distance
              ? 'challengeCreate.recap.includedFeminine'
              : 'challengeCreate.recap.excludedFeminine',
          )}
          detail={values.cumulative_distance && t('challengeCreate.recap.distanceDetail')}
        />
        <Row
          label={t('challengeDetail.categories.eliminationGeneric')}
          value={
            values.elimination && values.elimination_step_km !== undefined
              ? t('challengeCreate.recap.stepPerWeek', {
                  step: formatKm(values.elimination_step_km, locale),
                })
              : t('challengeCreate.recap.excludedFeminine')
          }
          detail={
            values.elimination &&
            t('challengeCreate.recap.eliminationDetail', { sport: sportName(reference) })
          }
        />
        <Row
          label={t('challengeDetail.categories.points')}
          value={
            values.points && values.points_podium
              ? t(`challengeCreate.recap.podium_${values.points_podium}`)
              : t('challengeCreate.recap.excluded')
          }
          detail={
            values.points && (
              <>
                {t('challengeCreate.recap.criteria', { criteria })}
                {values.points_criteria.includes('session_count') && (
                  <span className="block">
                    {t('challengeDetail.categories.pointsParams.minSession', {
                      minutes: values.points_min_session_minutes,
                    })}
                  </span>
                )}
              </>
            )
          }
        />
        {usesDistanceFactors(values) && (
          <Row
            label={t('challengeCreate.recap.factors')}
            value={t(
              factors.some(({ changed }) => changed)
                ? 'challengeCreate.recap.factorsCustom'
                : 'challengeCreate.recap.factorsSuggested',
            )}
            // The reference, ×1, is named just above.
            detail={factors.map(({ text }) => text).join(' · ')}
          />
        )}
      </Section>

      <p
        role="note"
        className="flex gap-3 rounded-row border border-risk-border bg-risk-bg p-4 text-risk-fg"
      >
        <TriangleAlert aria-hidden="true" size={20} className="mt-0.5 flex-none" />
        {t('challengeCreate.recap.final')}
      </p>

      {error && (
        <p ref={errorRef} role="alert" tabIndex={-1} className="flex gap-2 text-risk-fg">
          <TriangleAlert aria-hidden="true" size={20} className="mt-0.5 flex-none" />
          {error}
        </p>
      )}
    </div>
  );
}
