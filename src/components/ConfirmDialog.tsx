import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Modal confirmation: a title, a sentence saying what will happen, and two
 * buttons. Escape cancels. Uses the native `<dialog>`, which keeps the focus
 * inside and makes the rest of the page inert. A heavier confirmation adds
 * `details` (read with the message) and `children` above the buttons (a
 * checkbox), with `confirmDisabled` until the user has gone through them.
 * `variant="danger"` marks a final action (deleting, abandoning) in red; its
 * label still says what happens, the colour is never the only signal.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  details,
  children,
  confirmDisabled = false,
  variant = 'default',
}: {
  open: boolean;
  title: string;
  message: string;
  details?: ReactNode;
  children?: ReactNode;
  confirmDisabled?: boolean;
  variant?: 'default' | 'danger';
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
      // The safe choice gets the focus.
      cancel.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        // The parent closes it through `open`.
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2.5rem)] max-w-sm overflow-y-auto rounded-card bg-surface p-6 text-ink backdrop:bg-surface-raised/60"
    >
      <h2 id={titleId} className="font-display text-lg font-bold">
        {title}
      </h2>
      <div id={messageId} className="mt-2 text-muted">
        <p>{message}</p>
        {details}
      </div>
      {children}
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          // Not `disabled`: it stays reachable, so a screen reader finds it.
          aria-disabled={confirmDisabled || undefined}
          onClick={() => {
            if (!confirmDisabled) onConfirm();
          }}
          className={`h-13 rounded-full px-6 text-button font-bold aria-disabled:opacity-60 ${
            variant === 'danger' ? 'bg-danger text-on-danger' : 'bg-accent text-on-accent'
          }`}
        >
          {confirmLabel}
        </button>
        <button
          ref={cancel}
          type="button"
          onClick={onCancel}
          className="h-13 rounded-full border border-border bg-surface px-5 font-bold"
        >
          {cancelLabel}
        </button>
      </div>
    </dialog>
  );
}
