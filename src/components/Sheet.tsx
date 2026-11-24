import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A panel over the page: a sheet at the bottom of a phone, a centered panel
 * from the tablet. Uses the native `<dialog>`, which keeps the focus inside
 * and makes the rest of the page inert; Escape, the close button and a tap
 * outside it close it. The parent opens and closes it through `open`.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      close.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // The backdrop belongs to the dialog itself, its content to the panel.
        if (event.target === event.currentTarget) onClose();
      }}
      className="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-card bg-surface text-ink backdrop:bg-surface-raised/60 md:m-auto md:max-w-lg md:rounded-card"
    >
      <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:p-6">
        <div className="flex items-start gap-3">
          <h2 id={titleId} className="min-w-0 flex-1 font-display text-lg font-bold">
            {title}
          </h2>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            className="h-11 shrink-0 rounded-full px-4 font-bold hover-fill"
          >
            {t('sheet.close')}
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
