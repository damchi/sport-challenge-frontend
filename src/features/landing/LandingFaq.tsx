import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANDING_CONTAINER, SECTION, SECTION_TITLE } from './styles';

const QUESTIONS = ['free', 'visibility', 'password', 'join', 'leave', 'phone', 'data'] as const;

/** Questions fréquentes: native disclosures, the first one open. */
export function LandingFaq() {
  const { t } = useTranslation();
  return (
    <section id="faq" aria-labelledby="faq-title" className={`${SECTION} scroll-mt-4`}>
      <div className={`${LANDING_CONTAINER} max-w-3xl`}>
        <h2 id="faq-title" className={SECTION_TITLE}>
          {t('landing.faq.title')}
        </h2>
        <ul className="mt-6 flex flex-col gap-3">
          {QUESTIONS.map((question, index) => (
            <li key={question}>
              <details
                open={index === 0}
                className="group rounded-row border border-border bg-surface"
              >
                <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 rounded-row px-4 py-3 font-semibold hover-fill [&::-webkit-details-marker]:hidden">
                  {t(`landing.faq.${question}.q`)}
                  <ChevronDown
                    aria-hidden="true"
                    size={18}
                    strokeWidth={2}
                    className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="px-4 pb-4 text-muted">{t(`landing.faq.${question}.a`)}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
