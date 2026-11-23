import { useTranslation } from 'react-i18next';
import { PAGE_SIZES, type PageSize } from '../domain/pageSize';
import { Segmented } from './Segmented';

/**
 * « Afficher : 10 · 50 · Tout » above a list: as wide as the screen on a
 * phone, on the right from a tablet on.
 */
export function PageSizeChoice({
  size,
  onChange,
}: {
  size: PageSize;
  onChange: (size: PageSize) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="md:ml-auto md:w-72">
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
