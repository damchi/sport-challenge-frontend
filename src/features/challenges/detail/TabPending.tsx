import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../../components/states/EmptyState';

/** A section of the challenge whose content comes with a later ticket. */
export function TabPending() {
  const { t } = useTranslation();
  return <EmptyState message={t('challengeDetail.tabs.pending')} />;
}
