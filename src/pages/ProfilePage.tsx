import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from '../components/Page';
import { AppSettings } from '../features/settings/AppSettings';

/** Profile tab: for now its settings; the profile itself comes with its ticket. */
export function ProfilePage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('nav.profile')}</PageTitle>
      <AppSettings />
    </Page>
  );
}
