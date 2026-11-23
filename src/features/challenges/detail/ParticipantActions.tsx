import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Participant } from '../../../api/hooks/useChallenges';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { displayName } from '../../../domain/displayName';
import { focusOnMount } from '../../../lib/focusOnMount';
import type { Action, CreatorActions, Target } from './useCreatorActions';

/**
 * Outcome of the last action, announced. Once done, the row's buttons are
 * gone with the reloaded list: the outcome takes the focus instead.
 */
export function CreatorActionOutcome({ actions }: { actions: CreatorActions }) {
  const { t } = useTranslation();
  const { outcome } = actions;
  if (!outcome) return null;
  const failed = outcome.kind === 'failed';
  return (
    <p
      // A new outcome is a new element, which takes the focus once.
      key={outcome.id}
      ref={focusOnMount}
      tabIndex={-1}
      role={failed ? 'alert' : 'status'}
      className={`mb-3 text-sm font-semibold ${failed ? 'text-risk-fg' : ''}`}
    >
      {failed
        ? t(outcome.key, outcome.values)
        : t(`challengeDetail.participants.manage.${outcome.target.action}.done`, {
            name: outcome.target.name,
          })}
    </p>
  );
}

/** The two actions of a creator on an active participant who is not one. */
export function ParticipantActions({
  participant,
  actions,
}: {
  participant: Participant;
  actions: CreatorActions;
}) {
  const { t } = useTranslation();
  const name = displayName(participant) ?? t('challengeDetail.participants.unnamed');
  const busy = actions.sending?.userId === participant.user_id ? actions.sending.action : null;
  const button = (action: Action) => (
    <button
      type="button"
      // Not `disabled`: the focus comes back here when the dialog closes,
      // and a disabled button would drop it while the action is sent.
      aria-disabled={actions.sending !== null}
      // Named after the participant, among the buttons of every row; while
      // sent, the visible label alone.
      aria-label={
        busy === action
          ? undefined
          : t(`challengeDetail.participants.manage.${action}.buttonNamed`, { name })
      }
      onClick={() => actions.request(action, participant, name)}
      className="h-11 rounded-full border border-border bg-surface hover-fill px-4 text-sm font-bold aria-disabled:opacity-60"
    >
      {busy === action
        ? t(`challengeDetail.participants.manage.${action}.busy`)
        : t(`challengeDetail.participants.manage.${action}.button`)}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-3 px-3 pb-3">
      {button('creator')}
      {button('exclude')}
    </div>
  );
}

/** The confirmation of the action asked for, named after the participant. */
export function CreatorActionDialog({ actions }: { actions: CreatorActions }) {
  const { t } = useTranslation();
  // The last target stays while the dialog closes, so its text does not jump.
  const [shown, setShown] = useState<Target | null>(null);
  if (actions.confirming && actions.confirming !== shown) setShown(actions.confirming);
  const target = actions.confirming ?? shown;
  const action = target?.action ?? 'exclude';
  const prefix = `challengeDetail.participants.manage.${action}`;
  return (
    <ConfirmDialog
      open={actions.confirming !== null}
      title={t(`${prefix}.title`, { name: target?.name ?? '' })}
      message={t(`${prefix}.message`)}
      confirmLabel={t(`${prefix}.confirm`)}
      cancelLabel={t('challengeDetail.participants.manage.cancel')}
      variant={action === 'exclude' ? 'danger' : 'default'}
      onConfirm={actions.confirm}
      onCancel={actions.cancel}
    />
  );
}
