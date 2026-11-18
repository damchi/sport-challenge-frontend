import { useTranslation } from 'react-i18next';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('home.title')}</h1>
    </main>
  );
}
