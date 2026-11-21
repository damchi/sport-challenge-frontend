import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../lib/online';

/** While the device is offline: a connection is required (nothing is kept offline). */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <div className="px-5 lg:px-8">
      <p
        role="status"
        className="mx-auto mt-3 flex max-w-page items-center gap-3 rounded-row bg-surface-raised px-4 py-3 text-sm text-on-raised lg:max-w-wide"
      >
        <WifiOff aria-hidden="true" size={20} strokeWidth={2} className="shrink-0" />
        {t('offline.message')}
      </p>
    </div>
  );
}
