import { Ellipsis } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

const ITEM =
  'flex min-h-11 w-full items-center rounded-tab px-3 text-left text-sm font-semibold hover-fill';

/**
 * The "…" button of an activity that can still change: a disclosure with
 * "Edit" (a link to its form) and "Delete" (`onDelete` asks first). Escape
 * or a click elsewhere closes it, the focus back on the button, the same as
 * the challenge's menu. `describedBy` names the activity to a screen reader;
 * `buttonRef` lets the caller give the focus back to the button.
 */
export function ActivityMenu({
  activityId,
  describedBy,
  buttonRef,
  deleting,
  onDelete,
}: {
  activityId: string;
  describedBy: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  deleting: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLAnchorElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    // Not on blur: Safari does not focus a clicked button (see ChallengeMenu).
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
        aria-label={t('activities.menu')}
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-controls={listId}
        disabled={deleting}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface hover-fill disabled:opacity-60"
      >
        <Ellipsis aria-hidden="true" size={20} strokeWidth={2} />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute top-full right-0 z-10 mt-2 w-max max-w-[calc(100vw-2.5rem)] rounded-row border border-border bg-surface p-1 shadow-[0_4px_16px_rgba(22,24,29,.12)]"
      >
        <li>
          <Link
            ref={first}
            to={`/activities/${activityId}/edit`}
            aria-describedby={describedBy}
            className={`${ITEM} text-ink`}
          >
            {t('activities.edit')}
          </Link>
        </li>
        <li>
          <button
            type="button"
            aria-describedby={describedBy}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className={`${ITEM} text-danger`}
          >
            {t('activities.delete')}
          </button>
        </li>
      </ul>
    </div>
  );
}
