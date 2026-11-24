import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { Page, PageTitle } from '../components/Page';
import { AdminNav } from '../features/admin/AdminNav';

/** The admin section: its title, the way between its parts, then the part open. */
export function AdminPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('admin.title')}</PageTitle>
      <AdminNav />
      <Outlet />
    </Page>
  );
}
