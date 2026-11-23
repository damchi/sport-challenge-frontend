import { useTranslation } from 'react-i18next';
import { Avatar } from '../../components/Avatar';
import { displayName, type NamedUser } from '../../domain/displayName';

/**
 * "Others will see you like this": the avatar and the name shown, as typed
 * (pseudo, else first and last name). Until something is typed, a neutral
 * avatar and a waiting text.
 */
export function OnboardingPreview({ userId, user }: { userId: string; user: NamedUser }) {
  const { t } = useTranslation();
  const name = displayName(user);
  return (
    <div className="flex items-center gap-4 rounded-row bg-bg p-4">
      {name ? (
        <Avatar userId={userId} user={user} size="lg" />
      ) : (
        <span aria-hidden="true" className="size-13 shrink-0 rounded-full bg-segment" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-[0.6px] text-muted uppercase">
          {t('onboarding.preview.label')}
        </p>
        <p className={`text-lg font-bold break-words ${name ? '' : 'text-muted'}`}>
          {name ?? t('onboarding.preview.empty')}
        </p>
      </div>
    </div>
  );
}
