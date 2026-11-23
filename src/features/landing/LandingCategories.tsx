import { Lock, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICONS } from '../challenges/detail/categoryIcons';
import { EYEBROW, LANDING_CONTAINER, SECTION, SECTION_TITLE } from './styles';

// In the order of the categories (API README §2.3); the time is always there.
const CATEGORIES = [
  { type: 'cumulative_time', key: 'time', name: 'challengeCreate.categories.time.name' },
  {
    type: 'cumulative_distance',
    key: 'distance',
    name: 'challengeCreate.categories.distance.name',
  },
  {
    type: 'elimination',
    key: 'elimination',
    name: 'challengeDetail.categories.eliminationGeneric',
  },
  { type: 'points', key: 'points', name: 'challengeDetail.categories.points' },
  {
    type: 'cumulative_elevation',
    key: 'elevation',
    name: 'challengeCreate.categories.elevation.name',
  },
] as const;

/** « Comment on gagne »: a card per category, and the rules they share. */
export function LandingCategories() {
  const { t } = useTranslation();
  return (
    <section
      id="categories"
      aria-labelledby="categories-title"
      className={`${SECTION} scroll-mt-4`}
    >
      <div className={LANDING_CONTAINER}>
        <p className={EYEBROW}>{t('landing.categories.eyebrow')}</p>
        <h2 id="categories-title" className={SECTION_TITLE}>
          {t('landing.categories.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-muted">{t('landing.categories.lede')}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map(({ type, key, name }) => {
            const Icon = CATEGORY_ICONS[type];
            const always = type === 'cumulative_time';
            return (
              <li
                key={type}
                className="flex min-w-0 flex-col rounded-card border border-border bg-surface p-5"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex size-9 items-center justify-center rounded-row bg-accent-soft text-accent">
                    <Icon aria-hidden="true" size={18} strokeWidth={2} />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${always ? 'bg-surface-raised text-on-raised' : 'border border-border text-muted'}`}
                  >
                    {t(always ? 'landing.categories.always' : 'landing.categories.optional')}
                  </span>
                </span>
                <h3 className="mt-4 text-sm font-bold tracking-[0.6px] uppercase [overflow-wrap:anywhere]">
                  {t(name)}
                </h3>
                <p className="mt-2 mb-4 text-sm text-muted">
                  {t(`landing.categories.${key}.text`)}
                </p>
                <p className="mt-auto text-sm font-bold">{t(`landing.categories.${key}.win`)}</p>
              </li>
            );
          })}
        </ul>
        <ul className="mt-6 flex flex-col gap-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <Lock aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            {t('landing.categories.reference')}
          </li>
          <li className="flex items-start gap-2">
            <Scale aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            {t('landing.categories.fairness')}
          </li>
        </ul>
      </div>
    </section>
  );
}
