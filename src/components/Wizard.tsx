import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface WizardStep {
  title: string;
  content: ReactNode;
}

/**
 * A form in steps: progress, current step, Back and Next (none on the last
 * step). Next (or Enter)
 * moves on only once `validateStep` accepts the current step. The steps share
 * the caller's form state, so going back loses nothing.
 */
export function Wizard({
  steps,
  validateStep,
}: {
  steps: readonly WizardStep[];
  validateStep: (index: number) => Promise<boolean>;
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
    if ((await validateStep(index)) && !isLast) {
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

      {(index > 0 || !isLast) && (
        <div className="mt-8 flex gap-3">
          {index > 0 && (
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              className="inline-flex h-13 items-center gap-1 rounded-full border border-border bg-surface px-5 font-bold"
            >
              <ChevronLeft aria-hidden="true" size={20} />
              {t('wizard.back')}
            </button>
          )}
          {/* No Next on the last step: nothing comes after it. */}
          {!isLast && (
            <button
              type="submit"
              className="h-13 flex-1 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
            >
              {t('wizard.next')}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
