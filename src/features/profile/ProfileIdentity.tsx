import { useTranslation } from 'react-i18next';
import type { Me } from '../../api/hooks/useMe';
import { NamesForm } from './NamesForm';

/**
 * Who the user is: first and last name (changeable), then the e-mail,
 * read-only as GET /me gives it (it comes from the sign-in). A missing
 * e-mail is said missing, never left blank.
 */
export function ProfileIdentity({ me }: { me: Me }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="identity-title" className="mt-6">
      <h2 id="identity-title" className="text-sm font-semibold">
        {t('profile.identity.title')}
      </h2>
      <div className="mt-2 flex flex-col gap-4 rounded-row border border-border bg-surface p-4">
        <NamesForm me={me} />
        <dl className="border-t border-border pt-4">
          <dt className="text-sm font-semibold text-muted">{t('profile.identity.email')}</dt>
          <dd className={`mt-1 break-words ${me.email === null ? 'text-muted' : ''}`}>
            {me.email ?? t('profile.identity.missing')}
          </dd>
        </dl>
      </div>
    </section>
  );
}
