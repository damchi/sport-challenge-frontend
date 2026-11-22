import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

// No display here: each place says how it shows (or hides) the button.
const BUTTON =
  'min-h-12 items-center gap-2 rounded-full bg-accent px-6 py-2 text-button font-bold text-on-accent';

/**
 * The main action of the home page, as a button: `display` places it
 * (beside the title from `md`, in an empty list, floating on a phone).
 */
export function CreateChallengeLink({ display = 'inline-flex' }: { display?: string }) {
  const { t } = useTranslation();
  return (
    <Link to="/challenges/new" className={`${BUTTON} ${display}`}>
      <Plus aria-hidden="true" size={20} strokeWidth={2.5} className="flex-none" />
      {t('challenges.create')}
    </Link>
  );
}

/**
 * The main action floating at the bottom right of a phone, above the
 * navigation bar (design.md); from `md` it is beside the page title. It
 * stays within the screen when the text is enlarged.
 */
export function CreateChallengeFab() {
  return (
    <CreateChallengeLink display="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex min-h-14 max-w-[calc(100vw-2.5rem)] shadow-[0_6px_16px_rgba(22,24,29,.18)] md:hidden" />
  );
}
