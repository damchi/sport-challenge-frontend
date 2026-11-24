import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  adminReasonSchema,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  type AdminReason,
  type AdminReasonInput,
} from '../../domain/schemas/adminReason';
import { characterCount } from '../../domain/schemas/text';

/** Whether the server refused the reason itself (validation_failed on `reason`). */
function refusedReason(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'validation_failed' &&
    (error.params.fields ?? '')
      .split(',')
      .map((field) => field.trim())
      .includes('reason')
  );
}

/**
 * The confirmation of every admin change: what it does, then the reason the
 * journal keeps (3 to 500 characters, counted). "Cancel" has the focus; the
 * confirmation stays unavailable until the reason is long enough.
 * `variant="danger"` for a deletion or a block; `details`, read with the
 * summary, for what the change touches. `error` is the server's
 * answer to the last attempt: a refused reason is said under the field,
 * anything else above the buttons.
 */
export function ReasonDialog({
  open,
  title,
  summary,
  details,
  confirmLabel,
  variant = 'default',
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** What the change does, in a sentence. */
  summary: string;
  details?: ReactNode;
  confirmLabel: string;
  variant?: 'default' | 'danger';
  /** While the change is sent: the confirmation waits, and so does cancelling (it may be made). */
  pending?: boolean;
  error?: unknown;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const fieldId = `${id}-reason`;
  const form = useForm<AdminReasonInput, unknown, AdminReason>({
    resolver: zodResolver(adminReasonSchema),
    defaultValues: { reason: '' },
    mode: 'onChange',
  });
  const reason = useWatch({ control: form.control, name: 'reason' });
  const valid = adminReasonSchema.safeParse({ reason }).success;

  // Each opening starts from an empty reason.
  useEffect(() => {
    if (open) form.reset({ reason: '' });
  }, [open, form]);

  // "Too short" is what the hint and the unavailable button already say:
  // only the other problems are shown while typing.
  const schemaError = form.formState.errors.reason?.message;
  const fieldError = refusedReason(error)
    ? 'admin.reason.serverInvalid'
    : schemaError === 'admin.reason.short'
      ? undefined
      : schemaError;
  let otherError: string | undefined;
  if (error && !refusedReason(error)) {
    const { key, values } =
      error instanceof ApiError
        ? errorMessage(error, (candidate) => i18n.exists(candidate))
        : { key: 'errors.unknown', values: {} };
    otherError = t(key, values);
  }

  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={summary}
      details={details}
      confirmLabel={confirmLabel}
      cancelLabel={t('admin.reason.cancel')}
      variant={variant}
      confirmDisabled={!valid || pending}
      cancelDisabled={pending}
      onConfirm={() => void form.handleSubmit(({ reason: kept }) => onConfirm(kept))()}
      onCancel={onCancel}
    >
      <div className="mt-4">
        <label htmlFor={fieldId} className="block font-semibold">
          {t('admin.reason.label')}
        </label>
        <textarea
          id={fieldId}
          rows={3}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${id}-hint ${id}-error` : `${id}-hint`}
          className="mt-2 w-full rounded-row border border-border bg-surface px-4 py-3 text-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-risk-fg"
          {...form.register('reason')}
        />
        <div className="mt-2 flex justify-between gap-3 text-sm text-muted">
          <p id={`${id}-hint`}>
            {t('admin.reason.hint', { min: REASON_MIN_LENGTH, max: REASON_MAX_LENGTH })}
          </p>
          {/* The hint gives the bounds: the count is for the eye only. */}
          <p aria-hidden="true" className="shrink-0 tabular-nums">
            {t('admin.reason.count', {
              // Counted as the rule counts: trimmed, by code point.
              count: characterCount(reason.trim()),
              max: REASON_MAX_LENGTH,
            })}
          </p>
        </div>
        {fieldError && (
          <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-risk-fg">
            {t(fieldError, { min: REASON_MIN_LENGTH, max: REASON_MAX_LENGTH })}
          </p>
        )}
        {otherError && (
          <p role="alert" className="mt-3 text-sm text-risk-fg">
            {otherError}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}
