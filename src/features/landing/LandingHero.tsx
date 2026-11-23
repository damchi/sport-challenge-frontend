import { Mail, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChallengePreview } from './ChallengePreview';
import { SignInMessage } from './SignInMessage';
import { StartButton } from './StartButton';
import { LANDING_CONTAINER, SECONDARY_BUTTON } from './styles';
import type { LandingSignIn } from './useLandingSignIn';

/** The pitch, « Commencer » and an example of a challenge. */
export function LandingHero({ signIn }: { signIn: LandingSignIn }) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="landing-title"
      className={`${LANDING_CONTAINER} flex flex-wrap items-center gap-x-12 gap-y-10 py-10 lg:py-20`}
    >
      <div className="min-w-0 flex-[999_1_480px]">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
          <Users aria-hidden="true" size={14} strokeWidth={2} />
          {t('landing.hero.badge')}
        </p>
        <h1
          id="landing-title"
          className="mt-4 font-display text-4xl font-bold tracking-title [overflow-wrap:anywhere] lg:text-6xl"
        >
          {t('landing.hero.title')}
        </h1>
        <p className="mt-4 max-w-xl text-muted lg:text-lg">{t('landing.hero.lede')}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <StartButton signIn={signIn} source="top" />
          <a href="#how" className={SECONDARY_BUTTON}>
            {t('landing.hero.howLink')}
          </a>
        </div>
        <SignInMessage signIn={signIn} source="top" className="mt-4" />
        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <Mail aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          {t('landing.hero.noPassword')}
        </p>
      </div>
      <div className="min-w-0 flex-[1_1_320px]">
        <ChallengePreview />
      </div>
    </section>
  );
}
