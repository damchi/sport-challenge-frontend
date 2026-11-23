import { Activity, CalendarDays, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EYEBROW, LANDING_CONTAINER, SECTION, SECTION_TITLE } from './styles';

const STEPS = [
  { key: 'create', Icon: CalendarDays },
  { key: 'invite', Icon: UserPlus },
  { key: 'move', Icon: Activity },
] as const;

/** « Comment ça marche »: create, invite, move. */
export function LandingSteps() {
  const { t } = useTranslation();
  return (
    <section id="how" aria-labelledby="how-title" className={`${SECTION} scroll-mt-4 bg-surface`}>
      <div className={LANDING_CONTAINER}>
        <p className={EYEBROW}>{t('landing.how.eyebrow')}</p>
        <h2 id="how-title" className={SECTION_TITLE}>
          {t('landing.how.title')}
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ key, Icon }, index) => (
            <li key={key} className="rounded-card border border-border bg-bg p-5">
              <span className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">
                  {index + 1}
                </span>
                <Icon aria-hidden="true" size={20} strokeWidth={2} className="text-muted" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">
                {t(`landing.how.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-muted">{t(`landing.how.${key}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
