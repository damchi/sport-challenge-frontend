import { useTranslation } from 'react-i18next';
import { SignInCallback } from '../features/auth/SignInCallback';
import { Page, PageTitle } from '../components/Page';

export function CallbackPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('auth.callback.title')}</PageTitle>
      <SignInCallback />
    </Page>
  );
}
