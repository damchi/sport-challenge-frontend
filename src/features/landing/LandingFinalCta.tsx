import { useTranslation } from 'react-i18next';
import { SignInMessage } from './SignInMessage';
import { StartButton } from './StartButton';
import { LANDING_CONTAINER } from './styles';
import type { LandingSignIn } from './useLandingSignIn';

/** The last call to start, before the footer. */
export function LandingFinalCta({ signIn }: { signIn: LandingSignIn }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="final-title" className={`${LANDING_CONTAINER} pb-12 lg:pb-16`}>
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-card bg-surface-raised p-6 text-on-raised lg:p-10">
        <div className="min-w-0 flex-[1_1_320px]">
          <h2
            id="final-title"
            className="font-display text-2xl font-bold tracking-title lg:text-3xl"
          >
            {t('landing.final.title')}
          </h2>
          <p className="mt-2 text-on-raised-soft">{t('landing.final.text')}</p>
          <SignInMessage signIn={signIn} source="bottom" className="mt-3" />
        </div>
        <StartButton signIn={signIn} source="bottom" />
      </div>
    </section>
  );
}
