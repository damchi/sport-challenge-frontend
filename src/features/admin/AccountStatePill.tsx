import { Ban, CircleCheck, Clock, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminUser } from '../../api/hooks/admin/useAdminUsers';
import { StatusPill } from '../../components/StatusPill';

const PILLS = {
  active: { Icon: CircleCheck, tone: 'ok' },
  blocked: { Icon: Ban, tone: 'risk' },
  deleted: { Icon: Trash2, tone: 'neutral' },
  auth0_deletion_pending: { Icon: Clock, tone: 'risk' },
} as const;

/** The state of an account, as the server says: an icon and a label. */
export function AccountStatePill({ state }: { state: AdminUser['state'] }) {
  const { t } = useTranslation();
  const { Icon, tone } = PILLS[state];
  return <StatusPill Icon={Icon} tone={tone} label={t(`admin.users.states.${state}`)} />;
}
