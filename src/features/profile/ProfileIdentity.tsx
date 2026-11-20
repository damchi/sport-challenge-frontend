import { useTranslation } from 'react-i18next';
import type { Me } from '../../api/hooks/useMe';

function Item({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className={`mt-1 break-words ${value === null ? 'text-muted' : ''}`}>
        {value ?? t('profile.identity.missing')}
      </dd>
    </div>
  );
}

/**
 * The user's own names and e-mail, read-only, as GET /me gives them: the
 * e-mail comes from the sign-in, the names from the onboarding. A value the
 * server does not have is said missing, never left blank.
 */
export function ProfileIdentity({ me }: { me: Me }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="identity-title" className="mt-6">
      <h2 id="identity-title" className="text-sm font-semibold">
        {t('profile.identity.title')}
      </h2>
      <dl className="mt-2 rounded-row border border-border bg-surface p-4">
        <Item label={t('onboarding.firstName')} value={me.first_name} />
        <Item label={t('onboarding.lastName')} value={me.last_name} />
        <Item label={t('profile.identity.email')} value={me.email} />
      </dl>
    </section>
  );
}
