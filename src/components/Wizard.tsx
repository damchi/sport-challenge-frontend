import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface WizardStep {
  title: string;
  content: ReactNode;
}

/** The last step's action: it sends the form. */
export interface WizardFinish {
  label: string;
  /** Label while `busy`, when the button cannot be pressed again. */
  busyLabel: string;
  busy: boolean;
  onFinish: () => void;
}

/**
 * A form in steps: progress, current step, Back and Next, or the finishing
 * action on the last step. Next (or Enter) moves on, and the last step
 * finishes, only once `validateStep` accepts the current step. The steps
 * share the caller's form state, so going back loses nothing.
 */
export function Wizard({
  steps,
  validateStep,
  finish,
}: {
  steps: readonly WizardStep[];
  validateStep: (index: number) => Promise<boolean>;
  finish: WizardFinish;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // After a move, the focus goes to the new step's title so a screen reader
  // announces it; not on the first render.
  useEffect(() => {
    if (moved.current) {
      heading.current?.focus();
    }
  }, [index]);

  const goTo = (next: number) => {
    moved.current = true;
    setIndex(next);
  };

  const onSubmit = async () => {
    if (isLast && finish.busy) return;
    if (!(await validateStep(index))) return;
    if (isLast) {
      finish.onFinish();
    } else {
      goTo(index + 1);
    }
  };

  if (!step) {
    return null;
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      className="mt-6"
    >
      <p className="text-sm font-semibold text-muted">
        {t('wizard.progress', { current: index + 1, total: steps.length })}
      </p>
      <div aria-hidden="true" className="mt-2 flex gap-1.5">
        {steps.map((_, position) => (
          <span
            key={position}
            className={`h-1.5 flex-1 rounded-full ${position <= index ? 'bg-accent' : 'bg-track'}`}
          />
        ))}
      </div>
      <h2 ref={heading} tabIndex={-1} className="mt-4 font-display text-lg font-bold">
        {step.title}
      </h2>

      {/* Keyed: each step gets its own fields, never another step's. */}
      <div key={index} className="mt-4">
        {step.content}
      </div>

      <div className="mt-8 flex gap-3">
        {index > 0 && (
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={isLast && finish.busy}
            className="inline-flex h-13 items-center gap-1 rounded-full border border-border bg-surface px-5 font-bold disabled:opacity-60"
          >
            <ChevronLeft aria-hidden="true" size={20} />
            {t('wizard.back')}
          </button>
        )}
        <button
          type="submit"
          disabled={isLast && finish.busy}
          aria-busy={isLast && finish.busy ? true : undefined}
          // Whole line on a phone; its own width, on the right, from md.
          className="ml-auto h-13 flex-1 rounded-full bg-accent px-8 text-button font-bold text-on-accent disabled:opacity-60 md:flex-none"
        >
          {isLast ? (finish.busy ? finish.busyLabel : finish.label) : t('wizard.next')}
        </button>
      </div>
    </form>
  );
}
