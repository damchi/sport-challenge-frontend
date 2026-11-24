import { Activity, ChevronRight, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Me } from '../../api/hooks/useMe';
import { Avatar } from '../../components/Avatar';
import { displayName, fullName } from '../../domain/displayName';
import { PROFILE_CARD } from './profileCard';
import { ProfileStats } from './ProfileStats';

/**
 * Head of the profile: the initials avatar, the first and last name, the
 * pseudo under them, the user's numbers, then the way to their activities,
 * and to the admin section for an admin.
 */
export function ProfileHeader({ me }: { me: Me }) {
  const { t } = useTranslation();
  const name = fullName(me) ?? displayName(me);
  return (
    <div className={`${PROFILE_CARD} flex flex-col items-center text-center`}>
      <Avatar userId={me.id} user={me} size="xl" />
      {name && <p className="mt-4 max-w-full font-display text-xl font-bold break-words">{name}</p>}
      {/* Without names, the pseudo is already the name above. */}
      {me.pseudo && name !== me.pseudo && (
        <p className="mt-1 max-w-full break-words text-muted">
          {t('profile.handle', { pseudo: me.pseudo })}
        </p>
      )}
      <ProfileStats />
      <Link
        to="/activities"
        className="mt-5 flex min-h-12 w-full items-center gap-3 rounded-row bg-bg px-4 py-3 text-left font-semibold hover-fill"
      >
        <Activity aria-hidden="true" size={20} className="text-accent" />
        <span className="flex-1">{t('activities.title')}</span>
        <ChevronRight aria-hidden="true" size={20} className="text-muted" />
      </Link>
      {me.is_admin && (
        <Link
          to="/admin"
          className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-row bg-bg px-4 py-3 text-left font-semibold hover-fill"
        >
          <ShieldCheck aria-hidden="true" size={20} className="text-accent" />
          <span className="flex-1">{t('admin.title')}</span>
          <ChevronRight aria-hidden="true" size={20} className="text-muted" />
        </Link>
      )}
    </div>
  );
}
