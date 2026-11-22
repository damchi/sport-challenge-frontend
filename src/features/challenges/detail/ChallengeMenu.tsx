import { Ellipsis } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { challengeActions, type ChallengeAction } from '../../../domain/challenge';

export type MenuAction = ChallengeAction;

const LABELS: Record<MenuAction, string> = {
  edit: 'challengeDetail.edit.button',
  delete: 'challengeDetail.delete.button',
  abandon: 'challengeDetail.abandon.button',
};

/**
 * The "…" button of a challenge's header: a disclosure of the actions of
 * the user's role (none, no button). Escape or a click elsewhere closes it,
 * the focus back on the button; choosing an action closes it too, and the
 * page opens what the action needs. `buttonRef` lets the page give the focus
 * back to the button once that is done.
 */
export function ChallengeMenu({
  challenge,
  buttonRef,
  onSelect,
}: {
  challenge: ChallengeDetail;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onSelect: (action: MenuAction) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const actions = challengeActions(challenge);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    // A click, or the focus moving (Tab), outside the menu closes it. Not on
    // blur: Safari does not focus a clicked button, so a blur would close the
    // menu before the click on an action lands.
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('challengeDetail.menu')}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface"
      >
        <Ellipsis aria-hidden="true" size={20} strokeWidth={2} />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute top-full right-0 z-10 mt-2 w-max max-w-[calc(100vw-2.5rem)] rounded-row border border-border bg-surface p-1 shadow-[0_4px_16px_rgba(22,24,29,.12)]"
      >
        {actions.map((action, index) => (
          <li key={action}>
            <button
              ref={index === 0 ? first : undefined}
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect(action);
              }}
              className={`flex min-h-11 w-full items-center rounded-tab px-3 text-left text-sm font-semibold hover:bg-segment ${action === 'edit' ? 'text-ink' : 'text-danger'}`}
            >
              {t(LABELS[action])}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
