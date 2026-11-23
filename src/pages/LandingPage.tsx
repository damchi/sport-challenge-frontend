import { useTranslation } from 'react-i18next';
import { DocumentTitle } from '../components/DocumentTitle';
import { LandingCategories } from '../features/landing/LandingCategories';
import { LandingFaq } from '../features/landing/LandingFaq';
import { LandingFinalCta } from '../features/landing/LandingFinalCta';
import { LandingFooter } from '../features/landing/LandingFooter';
import { LandingHeader } from '../features/landing/LandingHeader';
import { LandingHero } from '../features/landing/LandingHero';
import { LandingSports } from '../features/landing/LandingSports';
import { LandingSteps } from '../features/landing/LandingSteps';
import { useLandingMeta } from '../features/landing/useLandingMeta';
import { useLandingSignIn } from '../features/landing/useLandingSignIn';
import { addLandingTranslations } from '../i18n/landing';

addLandingTranslations();

/** `/` for a visitor: what the app is, how challenges work, and « Commencer ». */
export function LandingPage() {
  const { t } = useTranslation();
  const signIn = useLandingSignIn();
  useLandingMeta();
  return (
    <>
      <DocumentTitle title={t('landing.pageTitle')} />
      <LandingHeader signIn={signIn} />
      <main>
        <LandingHero signIn={signIn} />
        <LandingSteps />
        <LandingCategories />
        <LandingSports />
        <LandingFaq />
        <LandingFinalCta signIn={signIn} />
      </main>
      <LandingFooter />
    </>
  );
}
