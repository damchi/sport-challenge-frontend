import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../../api/errors';
import {
  useAddCreator,
  useExcludeParticipant,
  type Participant,
} from '../../../api/hooks/useChallenges';

export type Action = 'creator' | 'exclude';

export interface Target {
  action: Action;
  userId: string;
  name: string;
}

// `id` tells one outcome from the next, even when they read the same.
type Outcome = { id: number } & (
  { kind: 'done'; target: Target } | { kind: 'failed'; key: string; values: Record<string, string> }
);

/**
 * State of the creators' actions on the participants of a challenge: the
 * one being confirmed, the one being sent, and the outcome of the last one.
 * A participant gone in the meantime (`not_found`) is said as such: the list
 * then reloads without them.
 */
export function useCreatorActions(challengeId: string) {
  const { i18n } = useTranslation();
  const addCreator = useAddCreator(challengeId);
  const exclude = useExcludeParticipant(challengeId);
  const [confirming, setConfirming] = useState<Target | null>(null);
  const [sending, setSending] = useState<Target | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const outcomes = useRef(0);

  const failure = (error: Error): { key: string; values: Record<string, string> } => {
    if (!(error instanceof ApiError)) return { key: 'errors.unknown', values: {} };
    if (error.code === 'not_found') {
      return { key: 'challengeDetail.participants.manage.gone', values: {} };
    }
    return errorMessage(error, (candidate) => i18n.exists(candidate));
  };

  return {
    confirming,
    sending,
    outcome,
    request: (action: Action, participant: Participant, name: string) => {
      if (sending) return;
      setConfirming({ action, userId: participant.user_id, name });
    },
    cancel: () => setConfirming(null),
    confirm: () => {
      const target = confirming;
      if (!target) return;
      setConfirming(null);
      setSending(target);
      setOutcome(null);
      const mutation = target.action === 'creator' ? addCreator : exclude;
      mutation.mutate(target.userId, {
        onSuccess: () => setOutcome({ id: (outcomes.current += 1), kind: 'done', target }),
        onError: (error) =>
          setOutcome({ id: (outcomes.current += 1), kind: 'failed', ...failure(error) }),
        onSettled: () => setSending(null),
      });
    },
  };
}

export type CreatorActions = ReturnType<typeof useCreatorActions>;
