import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSports } from '../../../api/hooks/useSports';
import { factorSports, sortSportsByName } from '../../../domain/challengeCreate';
import { formatFactor, formatKm } from '../../../domain/format/distance';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { useSportName } from './useSportName';
import { windowPreview } from './windowPreview';

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

/**
 * Step 4 of the creation: everything entered, before it is sent, with the
 * warning that the categories are final. `error` is the sending's, if any.
 */
export function RecapStep({ now, error }: { now: Date; error: string | undefined }) {
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
    code,
    text: `${sportName(code)} ${formatFactor(values.factors[code] ?? suggested, locale)}`,
  }));
  // A failed sending disables then frees the button: the focus goes to the
  // error, so the keyboard is not lost.
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <div className="flex flex-col gap-6">
      <dl className="rounded-row border border-border bg-surface p-4">
        <Item label={t('challengeCreate.fields.title.label')}>{values.title.trim()}</Item>
        {values.description !== '' && (
          <Item label={t('challengeCreate.recap.description')}>
            <span className="whitespace-pre-line">{values.description}</span>
          </Item>
        )}
        <Item label={t('challengeCreate.fields.visibility.label')}>
          {t(`challengeCreate.fields.visibility.${values.visibility}`)}
        </Item>
        <Item label={t('challengeCreate.recap.invitations')}>
          {t(
            values.members_can_invite
              ? 'challengeCreate.recap.membersCanInvite'
              : 'challengeCreate.recap.creatorsInvite',
          )}
        </Item>
        <Item label={t('challengeCreate.recap.period')}>
          {period &&
            t('challengeCreate.preview.period', {
              start: period.start,
              end: period.end,
              zone: period.zone,
            })}{' '}
          {t('challengeCreate.preview.weeks', { count: values.weeks })}
        </Item>
        <Item label={t('challengeCreate.fields.referenceSport.label')}>{sportName(reference)}</Item>
        <Item label={t('challengeCreate.recap.categories')}>
          <ol className="flex flex-col gap-1">
            <li>{t('challengeCreate.categories.time.name')}</li>
            {values.cumulative_distance && (
              <li>
                {t('challengeCreate.categories.distance.name')}
                <ul className="mt-1 text-sm text-muted">
                  <li>
                    {t('challengeCreate.recap.referenceFactor', {
                      sport: sportName(reference),
                      factor: formatFactor(1, locale),
                    })}
                  </li>
                  {factors.map(({ code, text }) => (
                    <li key={code}>{text}</li>
                  ))}
                </ul>
              </li>
            )}
            {values.elimination && values.elimination_step_km !== undefined && (
              <li>
                {t('challengeDetail.categories.elimination', { sport: sportName(reference) })}
                <span className="block text-sm text-muted">
                  {t('challengeCreate.recap.step', {
                    step: formatKm(values.elimination_step_km, locale),
                  })}
                </span>
              </li>
            )}
          </ol>
        </Item>
      </dl>

      <p
        role="note"
        className="flex gap-2 rounded-row border border-risk-border bg-risk-bg p-4 text-risk-fg"
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
