import { PencilLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatFactor } from '../../domain/format/distance';
import { EYEBROW, LANDING_CONTAINER, SECTION, SECTION_TITLE } from './styles';

// The catalogue's suggested factors, relative to running (API README §2.4);
// null: a sport without distance, counted in time only. The page is static:
// it calls no API, every route of which needs a signed-in user.
const SPORTS = [
  { code: 'run', factor: 1 },
  { code: 'ride', factor: 0.3 },
  { code: 'walk', factor: 1 },
  { code: 'hike', factor: 1 },
  { code: 'swim', factor: 1 },
  { code: 'rowing', factor: 0.5 },
  { code: 'roller', factor: 0.5 },
  { code: 'xc_ski', factor: 0.5 },
  { code: 'yoga', factor: null },
  { code: 'climbing', factor: null },
  { code: 'strength', factor: null },
] as const;

const CHIP =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold';

/** « Tous les sports »: each sport's distance factor, and how sessions are logged. */
export function LandingSports() {
  const { t, i18n } = useTranslation();
  return (
    <section
      id="sports"
      aria-labelledby="sports-title"
      className={`${SECTION} scroll-mt-4 bg-surface`}
    >
      <div className={`${LANDING_CONTAINER} flex flex-wrap gap-x-12 gap-y-8`}>
        <div className="min-w-0 flex-[1_1_260px]">
          <p className={EYEBROW}>{t('landing.sports.eyebrow')}</p>
          <h2 id="sports-title" className={SECTION_TITLE}>
            {t('landing.sports.title')}
          </h2>
          <p className="mt-3 text-muted">{t('landing.sports.lede')}</p>
        </div>
        <div className="min-w-0 flex-[999_1_480px]">
          <ul aria-label={t('landing.sports.listLabel')} className="flex flex-wrap gap-2">
            {SPORTS.map(({ code, factor }) => (
              <li key={code} className={`${CHIP} border border-border bg-bg`}>
                {t(`sports.${code}`)}
                <span className={factor === 1 ? 'text-accent' : 'font-normal text-muted'}>
                  {factor === null
                    ? t('landing.sports.timeOnly')
                    : formatFactor(factor, i18n.language)}
                </span>
              </li>
            ))}
            <li className={`${CHIP} border border-dashed border-border-dashed`}>
              {t('sports.other')}
            </li>
          </ul>
          <p className="mt-4 text-sm text-muted">{t('landing.sports.note')}</p>
          <p className="mt-4 flex items-start gap-3 rounded-row bg-surface-raised p-4 text-sm text-on-raised-soft">
            <PencilLine
              aria-hidden="true"
              size={18}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-risk-bar"
            />
            <span>
              <strong className="font-bold text-on-raised">
                {t('landing.sports.manualTitle')}
              </strong>{' '}
              {t('landing.sports.manualText')}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
