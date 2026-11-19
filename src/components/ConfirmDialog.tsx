import { useEffect, useId, useRef } from 'react';

/**
 * Modal confirmation: a title, a sentence saying what will happen, and two
 * buttons. Escape cancels. Uses the native `<dialog>`, which keeps the focus
 * inside and makes the rest of the page inert.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
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
      className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-card bg-surface p-6 text-ink backdrop:bg-surface-raised/60"
    >
      <h2 id={titleId} className="font-display text-lg font-bold">
        {title}
      </h2>
      <p id={messageId} className="mt-2 text-muted">
        {message}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onConfirm}
          className="h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
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
