import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { AppMark } from '../components/AppMark';
import { OnboardingForm } from '../features/profile/OnboardingForm';

/**
 * First profile, outside the app's navigation (mockups Bienvenue.png and
 * WebBienvenue.png): full width on a phone, a centred card from `md`.
 */
export function OnboardingPage() {
  const { t } = useTranslation();
  // The profile gate above has loaded it.
  const { data: me } = useMe();
  return (
    <div className="min-h-dvh bg-surface md:bg-bg">
      <main className="mx-auto w-full px-5 py-6 md:max-w-140 md:py-10">
        <p className="flex items-center gap-3 font-display text-xl font-bold md:justify-center">
          <AppMark />
          {t('home.title')}
        </p>
        <div className="mt-6 md:mt-8 md:rounded-card md:border md:border-border md:bg-surface md:p-10">
          <h1 className="font-display text-title font-bold tracking-title md:text-title-lg">
            {t('onboarding.title')}
          </h1>
          <p className="mt-2 text-muted">{t('onboarding.subtitle')}</p>
          {me && <OnboardingForm me={me} />}
        </div>
      </main>
    </div>
  );
}
