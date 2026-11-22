import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { useSportName } from '../create/useSportName';
import { CategoryParams } from './CategoryParams';
import { CATEGORY_ICONS } from './categoryIcons';
import { CATEGORY_EXPLANATIONS, useCategoryName } from './categoryNames';

const CARD = 'rounded-card border border-border bg-surface p-4 lg:p-5';

/**
 * « Comment on gagne »: a card per category, in their order, with its rule,
 * its frozen settings and what wins it.
 */
export function HowToWin({ challenge }: { challenge: ChallengeDetail }) {
  const { t } = useTranslation();
  const categoryName = useCategoryName(challenge.reference_sport);
  const sportName = useSportName();
  const ordered = [...challenge.categories].sort((a, b) => a.position - b.position);
  return (
    <section aria-labelledby="how-to-win">
      <h2 id="how-to-win" className="font-display text-xl font-bold">
        {t('challengeDetail.upcoming.howToWin.title')}
      </h2>
      <p className="mt-1 text-muted">
        {t('challengeDetail.upcoming.howToWin.intro', { count: ordered.length })}
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {ordered.map((category) => {
          const Icon = CATEGORY_ICONS[category.type];
          return (
            <li key={category.type} className={`${CARD} flex min-w-0 flex-col`}>
              <h3 className="flex items-center gap-3 text-lg font-bold">
                <span className="flex size-9 flex-none items-center justify-center rounded-row bg-accent-soft text-accent">
                  <Icon aria-hidden="true" size={18} strokeWidth={2} />
                </span>
                {/* A long word breaks rather than widen the page (text enlarged). */}
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {categoryName(category.type)}
                </span>
              </h3>
              <p className="mt-3 mb-1 text-muted">
                {t(CATEGORY_EXPLANATIONS[category.type], {
                  sport: sportName(challenge.reference_sport),
                })}
              </p>
              <div className="mb-3">
                <CategoryParams category={category} />
              </div>
              <p className="mt-auto border-t border-border pt-3 font-semibold">
                {t(`challengeDetail.upcoming.howToWin.wins.${category.type}`)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
