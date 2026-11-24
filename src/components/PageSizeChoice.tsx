import { useTranslation } from 'react-i18next';
import { PAGE_SIZES, type PageSize } from '../domain/pageSize';
import { Segmented } from './Segmented';

/**
 * « Afficher : 10 · 50 · Tout » above a list: as wide as the screen on a
 * phone, on the right from a tablet on. `legend` names it to screen readers
 * when a page has several lists.
 */
export function PageSizeChoice({
  size,
  onChange,
  legend,
}: {
  size: PageSize;
  onChange: (size: PageSize) => void;
  legend?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role={legend ? 'group' : undefined} aria-label={legend} className="md:ml-auto md:w-72">
      <Segmented
        inline
        legend={t('lists.pageSize.legend')}
        options={PAGE_SIZES}
        selected={size}
        onSelect={onChange}
        label={(value) => (value === 'all' ? t('lists.pageSize.all') : value)}
      />
    </div>
  );
}
