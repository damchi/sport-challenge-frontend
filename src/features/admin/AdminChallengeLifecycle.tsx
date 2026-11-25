import { RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  sendAdminChallengeLifecycleChange,
  type AdminChallengeLifecycleChange,
} from '../../api/hooks/admin/adminChallengeLifecycle';
import type { AdminChallengeDetail } from '../../api/hooks/admin/useAdminChallenges';
import { useAdminCorrection, type CorrectionBody } from '../../api/hooks/admin/useAdminCorrection';
import type { ApiClient } from '../../api/client';
import { ReasonDialog } from './ReasonDialog';
import { RecomputeFlow } from './RecomputeFlow';

const RESTORE_POINTS = ['found', 'weeks', 'links', 'preview'] as const;

/**
 * The deletion of a challenge, and the restore of a deleted one (mockups
 * « Fiche d'un défi » and « Défi supprimé à restaurer »). A deletion asks
 * for the reason in a "danger" dialog; a restore judges the challenge again,
 * so it goes through `RecomputeFlow` (preview, then reason), whose preview
 * takes the place of the whole sheet. `children` gets the part to place in
 * the sheet: the card to delete it, or the notice of its deletion with the
 * way to restore it. Kept above the sheet, so that the change made, which
 * turns one sheet into the other, is said once it is back.
 */
export function AdminChallengeLifecycle({
  challenge,
  at,
  children,
}: {
  challenge: AdminChallengeDetail;
  /** An instant of the challenge, in its time zone. */
  at: (instant: string) => string;
  children: (part: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation();
  const [made, setMade] = useState<AdminChallengeLifecycleChange | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);
  // Each restore made starts a new flow, back on the sheet.
  const [round, setRound] = useState(0);
  const outcome = useRef<HTMLParagraphElement>(null);
  const { id, title } = challenge;

  const send =
    (change: AdminChallengeLifecycleChange) => (client: ApiClient, body: CorrectionBody) =>
      sendAdminChallengeLifecycleChange(client, change, id, body);
  const deletion = useAdminCorrection(send('delete'));

  // Back on the sheet after a change: the focus goes to what it says.
  useEffect(() => {
    if (made) outcome.current?.focus();
  }, [made]);

  const remove = (reason: string) => {
    // Kept unavailable until the dialog closes: the deletion is made.
    void deletion.mutateAsync({ reason, dry_run: false }).then(
      () => {
        setClosing(true);
        setDeleting(false);
        setMade('delete');
      },
      // Said in the dialog, from the mutation's error.
      () => undefined,
    );
  };

  return (
    <>
      <p
        ref={outcome}
        role="status"
        tabIndex={-1}
        className={
          made ? 'rounded-row bg-ok-bg px-4 py-3 font-semibold text-ok-fg outline-none' : 'sr-only'
        }
      >
        {made && t(`admin.lifecycle.${made}.made`, { title })}
      </p>
      <RecomputeFlow
        key={round}
        change={{ title: t('admin.lifecycle.restore.title', { title }) }}
        reasonTitle={t('admin.lifecycle.restore.reasonTitle')}
        confirmLabel={t('admin.lifecycle.restore.confirm')}
        send={send('restore')}
        onDone={() => {
          setMade('restore');
          setRound((value) => value + 1);
        }}
      >
        {({ showPreview, pending, error }) =>
          children(
            challenge.deleted_at === null ? (
              <DeleteCard
                onDelete={() => {
                  deletion.reset();
                  setClosing(false);
                  setMade(null);
                  setDeleting(true);
                }}
              />
            ) : (
              <RestorePanel
                deletedAt={at(challenge.deleted_at)}
                pending={pending}
                error={error}
                onRestore={() => {
                  setMade(null);
                  showPreview();
                }}
              />
            ),
          )
        }
      </RecomputeFlow>
      <ReasonDialog
        open={deleting}
        title={t('admin.lifecycle.delete.reasonTitle')}
        summary={t('admin.lifecycle.delete.summary', { title })}
        confirmLabel={t('admin.lifecycle.delete.confirm')}
        variant="danger"
        pending={deletion.isPending || closing}
        error={deletion.error}
        onConfirm={remove}
        onCancel={() => {
          deletion.reset();
          setDeleting(false);
        }}
      />
    </>
  );
}

/** The card to delete the challenge, last on its sheet. */
function DeleteCard({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="admin-challenge-delete"
      className="flex flex-col items-start gap-3 rounded-card border border-dashed border-border-dashed p-4 lg:p-5"
    >
      <h3 id="admin-challenge-delete" className="font-display text-lg font-bold">
        {t('admin.lifecycle.delete.title')}
      </h3>
      <p className="text-muted">{t('admin.lifecycle.delete.help')}</p>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-danger bg-surface px-5 font-bold text-danger hover-fill"
      >
        <Trash2 aria-hidden="true" size={18} />
        {t('admin.lifecycle.delete.button')}
      </button>
    </section>
  );
}

/** When the challenge was deleted, what a restore does, and the way to it. */
function RestorePanel({
  deletedAt,
  pending,
  error,
  onRestore,
}: {
  deletedAt: string;
  pending: boolean;
  /** Why the preview was refused. */
  error: string | undefined;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div
        role="note"
        className="flex flex-col gap-4 rounded-card bg-surface-raised p-4 text-on-raised md:flex-row md:items-center md:justify-between lg:p-6"
      >
        <div className="flex gap-3">
          <Trash2 aria-hidden="true" size={24} className="flex-none text-risk-bar" />
          <div>
            <p className="font-bold">
              {t('admin.lifecycle.restore.deletedAt', { date: deletedAt })}
            </p>
            <p className="text-on-raised-muted">{t('admin.lifecycle.restore.notice')}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <button
            type="button"
            aria-disabled={pending}
            aria-busy={pending}
            onClick={() => {
              if (!pending) onRestore();
            }}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent hover-accent aria-disabled:opacity-60"
          >
            <RotateCcw aria-hidden="true" size={20} />
            {t('admin.lifecycle.restore.button')}
          </button>
          {error && (
            <p role="alert" className="text-sm font-semibold text-risk-bar">
              {error}
            </p>
          )}
        </div>
      </div>
      <section
        aria-labelledby="admin-challenge-restore"
        className="rounded-card border border-border bg-surface p-4 lg:p-5"
      >
        <h3 id="admin-challenge-restore" className="font-display text-lg font-bold">
          {t('admin.lifecycle.restore.what')}
        </h3>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
          {RESTORE_POINTS.map((point) => (
            <li key={point}>{t(`admin.lifecycle.restore.points.${point}`)}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
