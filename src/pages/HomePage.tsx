import { useTranslation } from 'react-i18next';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-[480px] px-5 py-8">
      <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.5px]">{t('home.title')}</h1>
    </main>
  );
}
