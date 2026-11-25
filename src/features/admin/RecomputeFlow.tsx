import { ArrowLeft, ArrowRight, Check, Info } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminChallenge } from '../../api/hooks/admin/useAdminChallenges';
import {
  useAdminCorrection,
  type AdminCorrection,
  type CorrectionBody,
} from '../../api/hooks/admin/useAdminCorrection';
import type { ApiClient } from '../../api/client';
import { ApiError, errorMessage } from '../../api/errors';
import { ReasonDialog } from './ReasonDialog';
import { RecomputePreview } from './RecomputePreview';

/** The change, as the preview and the reason dialog recall it. */
export interface RecomputeChange {
  /** "Ajouter une activité à Marc Dubois". */
  title: string;
  /** "Course · jeu. 12 nov. à 18:30 · 46 min 10 s · 8,2 km". */
  details?: string;
}

type Step = 'input' | 'preview' | 'reason';

/** The title of a challenge the change touches, from its admin sheet. */
function ChallengeTitle({ challengeId }: { challengeId: string }) {
  const { t } = useTranslation();
  const challenge = useAdminChallenge(challengeId);
  return <>{challenge.data?.title ?? t('admin.recompute.challenge')}</>;
}

const STEPS = [
  { key: 'change', state: 'done' },
  { key: 'preview', state: 'current' },
  { key: 'reason', state: 'next' },
] as const;

/** The steps of the change, the preview being the current one. */
function Steps() {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2">
      {STEPS.map(({ key, state }, position) => (
        <li
          key={key}
          aria-current={state === 'current' ? 'step' : undefined}
          className={`flex items-center gap-2 ${state === 'current' ? 'font-bold text-ink' : 'text-muted'}`}
        >
          <span
            aria-hidden="true"
            className={`flex size-7 flex-none items-center justify-center rounded-full text-sm ${
              state === 'done'
                ? 'bg-ok-bg text-ok-fg'
                : state === 'current'
                  ? 'bg-accent text-on-accent'
                  : 'border border-border'
            }`}
          >
            {state === 'done' ? <Check size={16} strokeWidth={3} /> : position + 1}
          </span>
          {t(`admin.recompute.steps.${key}`)}
          {state === 'done' && <span className="sr-only">{t('wizard.done')}</span>}
        </li>
      ))}
    </ol>
  );
}

/** The translated words of an error the server answered. */
function useErrorText(error: unknown, scope: string | undefined): string | undefined {
  const { t, i18n } = useTranslation();
  if (!error) return undefined;
  const { key, values } =
    error instanceof ApiError
      ? errorMessage(error, (candidate) => i18n.exists(candidate), scope)
      : { key: 'errors.unknown', values: {} };
  return t(key, values);
}

/**
 * The way through every admin change that judges challenges again
 * (mockups « Aperçu du recalcul » and « Boîte Motif »): the change's own
 * fields (`children`, given `showPreview`), then the page « Aperçu des
 * changements » (`dry_run`, without a reason, nothing written), then the
 * reason in a dialog, which makes the change. "Modifier la saisie" and
 * "Retour" go back to the fields, kept by the caller, which also keeps its
 * preview's refusal (`error`) in sight, beside its button, and its
 * "Voir l'aperçu" unavailable while `pending`. `send` makes the change's
 * request; `onDone` gets the server's answer once it is made, and leaves
 * the flow (the reason dialog stays unavailable until then).
 */
export function RecomputeFlow({
  change,
  reasonTitle,
  confirmLabel,
  variant = 'default',
  errorScope,
  send,
  onDone,
  children,
}: {
  change: RecomputeChange;
  /** Title of the reason dialog ("Confirmer l'ajout de l'activité"). */
  reasonTitle: string;
  confirmLabel: string;
  variant?: 'default' | 'danger';
  /** Where the change's own words for the server's errors are (`errorMessage`). */
  errorScope?: string;
  send: (client: ApiClient, body: CorrectionBody) => Promise<AdminCorrection | undefined>;
  onDone: (correction: AdminCorrection) => void;
  children: (input: {
    showPreview: () => void;
    pending: boolean;
    /** Why the preview was refused, for the caller to show by its button. */
    error: string | undefined;
  }) => ReactNode;
}) {
  const { t } = useTranslation();
  const correction = useAdminCorrection(send);
  const [step, setStep] = useState<Step>('input');
  const [preview, setPreview] = useState<AdminCorrection | null>(null);
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLDivElement>(null);
  // Back from the preview: the focus goes to the fields, not lost on the page.
  const [returned, setReturned] = useState(false);
  const previewError = useErrorText(step === 'input' ? correction.error : undefined, errorScope);

  // On the preview, the focus goes to its title so a screen reader announces it.
  useEffect(() => {
    if (step === 'preview') heading.current?.focus();
    if (step === 'input' && returned) input.current?.focus();
  }, [step, returned]);

  const showPreview = () => {
    correction.mutate(
      { dry_run: true },
      {
        onSuccess: (answer) => {
          setPreview(answer);
          setStep('preview');
        },
      },
    );
  };
  const backToInput = () => {
    correction.reset();
    setReturned(true);
    setStep('input');
  };
  const confirm = (reason: string) => {
    correction.mutate(
      { reason, dry_run: false },
      {
        onSuccess: (answer) => {
          setDone(true);
          onDone(answer);
        },
      },
    );
  };

  if (step === 'input' || !preview) {
    return (
      <div ref={input} tabIndex={-1} className="outline-none">
        {children({ showPreview, pending: correction.isPending, error: previewError })}
      </div>
    );
  }

  const touched = preview.challenges;
  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={backToInput}
        className="-ml-2 inline-flex h-11 items-center gap-2 self-start rounded-tab px-2 font-semibold text-muted hover-fill"
      >
        <ArrowLeft aria-hidden="true" size={18} />
        {t('admin.recompute.edit')}
      </button>
      <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-bold md:text-3xl">
        {t('admin.recompute.title')}
      </h2>
      <Steps />
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t('admin.recompute.steps.change')}
          </p>
          <p className="font-bold">{change.title}</p>
          {change.details && <p>{change.details}</p>}
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          <Info aria-hidden="true" size={18} className="flex-none" />
          {t('admin.recompute.nothingSaved')}
        </p>
      </section>
      <RecomputePreview correction={preview} />
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={backToInput}
          className="h-13 rounded-full border border-border bg-surface px-6 font-bold hover-fill"
        >
          {t('admin.recompute.back')}
        </button>
        <button
          type="button"
          onClick={() => {
            correction.reset();
            setStep('reason');
          }}
          className="inline-flex h-13 items-center gap-2 rounded-full bg-accent px-8 text-button font-bold text-on-accent hover-accent"
        >
          {t('admin.recompute.continue')}
          <ArrowRight aria-hidden="true" size={20} />
        </button>
      </div>
      <ReasonDialog
        open={step === 'reason'}
        title={reasonTitle}
        summary={
          change.details
            ? t('admin.recompute.summary', { title: change.title, details: change.details })
            : change.title
        }
        details={
          touched.length > 0 && (
            <p className="mt-2">
              <span className="font-bold">
                {t('admin.recompute.touched', { count: touched.length })}
              </span>{' '}
              {touched.map((challenge, index) => (
                <span key={challenge.challenge_id}>
                  {index > 0 && ', '}
                  <ChallengeTitle challengeId={challenge.challenge_id} />
                </span>
              ))}
            </p>
          )
        }
        confirmLabel={confirmLabel}
        variant={variant}
        errorScope={errorScope}
        pending={correction.isPending || done}
        error={correction.error}
        onConfirm={confirm}
        onCancel={() => {
          correction.reset();
          setStep('preview');
        }}
      />
    </div>
  );
}
