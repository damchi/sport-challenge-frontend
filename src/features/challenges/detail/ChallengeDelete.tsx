import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../../../api/errors';
import { useDeleteChallenge, type ChallengeDetail } from '../../../api/hooks/useChallenges';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { focusOnMount } from '../../../lib/focusOnMount';
import { inputClass } from '../create/fields';

/**
 * Deletes a challenge, for its creators (the server's role), at any time,
 * finished included. The confirmation says that everything disappears for
 * every participant, and asks to type the challenge's title before it
 * deletes. Opened from the page's menu (`open`); `onClose` gives the focus
 * back. Deleted: back to the home page.
 */
export function ChallengeDelete({
  challenge,
  open,
  onClose,
}: {
  challenge: ChallengeDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const remove = useDeleteChallenge(challenge.id);
  const [typed, setTyped] = useState('');
  // A new attempt: the title typed before and the previous refusal go away.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped('');
  }
  const inputId = useId();

  if (challenge.my_role !== 'creator') return null;

  const message =
    remove.error instanceof ApiError
      ? errorMessage(remove.error, (candidate) => i18n.exists(candidate))
      : remove.error
        ? { key: 'errors.unknown', values: {} }
        : undefined;
  const matches = typed.trim() === challenge.title.trim();

  return (
    <>
      {message && !open && (
        // The dialog is closed: the refusal takes the focus, once (a new
        // attempt hides it first).
        <p
          ref={focusOnMount}
          tabIndex={-1}
          role="alert"
          className="mt-3 text-sm font-semibold text-risk-fg"
        >
          {t(message.key, message.values)}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title={t('challengeDetail.delete.title', { title: challenge.title })}
        message={t('challengeDetail.delete.message')}
        confirmDisabled={!matches}
        variant="danger"
        confirmLabel={t('challengeDetail.delete.confirm')}
        cancelLabel={t('challengeDetail.delete.cancel')}
        onConfirm={() => {
          onClose();
          if (remove.isPending) return;
          remove.mutate(undefined, {
            onSuccess: () => void navigate('/', { replace: true }),
          });
        }}
        onCancel={() => {
          remove.reset();
          onClose();
        }}
      >
        <div className="mt-4">
          <label htmlFor={inputId} className="block text-sm font-semibold text-ink break-words">
            {t('challengeDetail.delete.typeTitle', { title: challenge.title })}
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={`${inputId}-hint`}
            className={`${inputClass} h-11 w-full`}
          />
          <p id={`${inputId}-hint`} className="mt-1 text-sm text-muted">
            {t('challengeDetail.delete.typeTitleHint')}
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
