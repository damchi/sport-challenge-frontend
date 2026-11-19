import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { Avatar } from '../components/Avatar';
import { AppSettings } from '../features/settings/AppSettings';

export function ProfilePage() {
  const { t } = useTranslation();
  // Loaded by the profile gate above.
  const { data: me } = useMe();
  return (
    <main className="mx-auto max-w-page px-5 py-8">
      <h1 className="font-display text-title font-bold tracking-title">{t('nav.profile')}</h1>
      {me?.pseudo && (
        <p className="mt-4 flex items-center gap-3 font-semibold">
          <Avatar userId={me.id} pseudo={me.pseudo} />
          {me.pseudo}
        </p>
      )}
      <AppSettings />
    </main>
  );
}
