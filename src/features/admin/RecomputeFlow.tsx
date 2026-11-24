import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAdminCorrection,
  type AdminCorrection,
  type CorrectionBody,
} from '../../api/hooks/admin/useAdminCorrection';
import type { ApiClient } from '../../api/client';
import { ApiError, errorMessage } from '../../api/errors';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ReasonDialog } from './ReasonDialog';
import { RecomputePreview } from './RecomputePreview';

/** The reason given, and what the server says the change would do with it. */
interface Previewed {
  reason: string;
  correction: AdminCorrection;
}

/**
 * The way through every admin change that judges challenges again, once
 * its fields are filled in: the reason (the server wants it for a preview
 * too), then the preview (`dry_run`), then the confirmation, which sends the
 * same change with the same reason. Cancelling at any step sends nothing
 * more. `send` makes the change's request; `onDone` gets the server's
 * answer once the change is made.
 */
export function RecomputeFlow({
  open,
  title,
  summary,
  confirmLabel,
  variant = 'default',
  send,
  onDone,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** What the change does, in a sentence. */
  summary: string;
  confirmLabel: string;
  variant?: 'default' | 'danger';
  send: (client: ApiClient, body: CorrectionBody) => Promise<AdminCorrection | undefined>;
  onDone: (correction: AdminCorrection) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const correction = useAdminCorrection(send);
  const [previewed, setPreviewed] = useState<Previewed | null>(null);
  // Closed, the flow forgets: the next opening starts again from the reason.
  const forget = () => {
    setPreviewed(null);
    correction.reset();
  };
  const cancel = () => {
    forget();
    onCancel();
  };

  const preview = (reason: string) => {
    correction.mutate(
      { reason, dry_run: true },
      { onSuccess: (answer) => setPreviewed({ reason, correction: answer }) },
    );
  };
  const confirm = () => {
    if (!previewed) return;
    correction.mutate(
      { reason: previewed.reason, dry_run: false },
      {
        onSuccess: (answer) => {
          forget();
          onDone(answer);
        },
      },
    );
  };

  const error = correction.error;
  let errorText: string | undefined;
  if (previewed && error) {
    const { key, values } =
      error instanceof ApiError
        ? errorMessage(error, (candidate) => i18n.exists(candidate))
        : { key: 'errors.unknown', values: {} };
    errorText = t(key, values);
  }

  return (
    <>
      <ReasonDialog
        open={open && !previewed}
        title={title}
        summary={summary}
        confirmLabel={t('admin.recompute.see')}
        pending={correction.isPending}
        error={previewed ? undefined : error}
        onConfirm={preview}
        onCancel={cancel}
      />
      <ConfirmDialog
        open={open && previewed !== null}
        title={title}
        message={t('admin.recompute.intro')}
        confirmLabel={confirmLabel}
        cancelLabel={t('admin.reason.cancel')}
        variant={variant}
        wide
        confirmDisabled={correction.isPending}
        // Once confirmed, the change may already be made: no way out until the answer.
        cancelDisabled={correction.isPending}
        onConfirm={confirm}
        onCancel={cancel}
      >
        {previewed && (
          <div className="mt-4">
            <RecomputePreview correction={previewed.correction} />
          </div>
        )}
        {errorText && (
          <p role="alert" className="mt-4 text-sm text-risk-fg">
            {errorText}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
