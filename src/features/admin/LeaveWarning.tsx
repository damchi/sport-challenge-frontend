import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useLeaveWarning } from '../challenges/create/useLeaveWarning';

/**
 * While `active`, leaving the page asks first (the tab's closing or reload
 * gets the browser's own warning). A router holds one blocker at a time: a
 * step mounts it only while no other part of the page holds one.
 */
export function LeaveWarning({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const blocker = useLeaveWarning(active);
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={t('admin.leave.title')}
      message={t('admin.leave.message')}
      confirmLabel={t('admin.leave.confirm')}
      cancelLabel={t('admin.leave.cancel')}
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );
}
