import { Check, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export interface WizardStep {
  /** Short name, in the progress ("Infos"). */
  name: string;
  /** Heading of the step ("Le défi"). */
  title: string;
  /** The step's fields; given `goTo` when it links to another step. */
  content: ReactNode | ((goTo: (index: number) => void) => ReactNode);
  /** Side column, from `lg` only: what helps without being needed. */
  aside?: ReactNode;
}

/** The last step's action: it sends the form. */
export interface WizardFinish {
  label: string;
  /** Label while `busy`, when the button cannot be pressed again. */
  busyLabel: string;
  busy: boolean;
  onFinish: () => void;
}

/** Leaving from the first step, from `md` (a phone's page has its own way out). */
export interface WizardCancel {
  label: string;
  to: string;
}

/**
 * A form in steps: progress, current step, Back and Next, or the finishing
 * action on the last step. Next (or Enter) moves on, and the last step
 * finishes, only once `validateStep` accepts the current step; a step may
 * also send back to an earlier one. The steps share the caller's form state,
 * so going back loses nothing.
 * Phone: "Étape 1 sur 4 · Infos" over a bar, actions held at the bottom of
 * the screen. From `md`: numbered steps above a card, and from `lg` the
 * step's side column next to it.
 */
export function Wizard({
  steps,
  validateStep,
  finish,
  cancel,
}: {
  steps: readonly WizardStep[];
  validateStep: (index: number) => Promise<boolean>;
  finish: WizardFinish;
  cancel?: WizardCancel;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  // Whether the user moved yet: the first step's title is not focused.
  const [moved, setMoved] = useState(false);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // After a move, the focus goes to the new step's title so a screen reader
  // announces it; not on the first render.
  useEffect(() => {
    if (moved) {
      heading.current?.focus();
    }
  }, [index, moved]);

  const goTo = (next: number) => {
    setMoved(true);
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
      className="mt-4 md:mt-6"
    >
      <ol className="hidden gap-3 md:grid md:grid-flow-col md:auto-cols-fr">
        {steps.map(({ name }, position) => {
          const done = position < index;
          const current = position === index;
          return (
            <li key={name} aria-current={current ? 'step' : undefined}>
              <span
                aria-hidden="true"
                className={`block h-1 rounded-full ${position <= index ? 'bg-accent' : 'bg-track'}`}
              />
              <span
                className={`mt-3 flex items-center gap-2 font-semibold ${position <= index ? 'text-ink' : 'text-muted'}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-7 flex-none items-center justify-center rounded-full border-2 text-sm ${
                    done
                      ? 'border-accent bg-accent text-on-accent'
                      : current
                        ? 'border-accent text-accent'
                        : 'border-border'
                  }`}
                >
                  {done ? <Check size={16} strokeWidth={3} /> : position + 1}
                </span>
                {name}
                {done && <span className="sr-only">{t('wizard.done')}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-start gap-6 md:mt-8">
        <div className="min-w-0 flex-[999_1_560px] md:rounded-card md:border md:border-border md:bg-surface md:p-8">
          <p className="text-sm font-semibold text-muted">
            {t('wizard.progress', { current: index + 1, total: steps.length })}
            <span className="md:hidden"> · {step.name}</span>
          </p>
          <div aria-hidden="true" className="mt-2 flex gap-1.5 md:hidden">
            {steps.map(({ name }, position) => (
              <span
                key={name}
                className={`h-1.5 flex-1 rounded-full ${position <= index ? 'bg-accent' : 'bg-track'}`}
              />
            ))}
          </div>
          <h2
            ref={heading}
            tabIndex={-1}
            className="mt-6 font-display text-2xl font-bold md:mt-1 md:text-xl"
          >
            {step.title}
          </h2>

          {/* Keyed: each step gets its own fields, never another step's. */}
          <div key={index} className="mt-6">
            {typeof step.content === 'function' ? step.content(goTo) : step.content}
          </div>

          {/* Held above the phone's navigation bar while the step scrolls. */}
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-5 mt-8 flex items-center gap-3 border-t border-border bg-bg px-5 py-3 md:static md:mx-0 md:bg-transparent md:px-0 md:pt-6 md:pb-0">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                disabled={isLast && finish.busy}
                className="inline-flex h-13 items-center gap-1 rounded-full border border-border bg-surface hover-fill px-5 font-bold disabled:opacity-60"
              >
                <ChevronLeft aria-hidden="true" size={20} className="hidden md:block" />
                {t('wizard.back')}
              </button>
            ) : (
              cancel && (
                <Link
                  to={cancel.to}
                  className="hidden h-11 items-center font-semibold text-muted underline underline-offset-4 md:inline-flex hover-link"
                >
                  {cancel.label}
                </Link>
              )
            )}
            <button
              type="submit"
              disabled={isLast && finish.busy}
              aria-busy={isLast && finish.busy ? true : undefined}
              // Whole line on a phone; its own width, on the right, from md.
              className="ml-auto h-13 flex-1 rounded-full bg-accent hover-accent px-8 text-button font-bold text-on-accent disabled:opacity-60 md:flex-none"
            >
              {isLast ? (finish.busy ? finish.busyLabel : finish.label) : t('wizard.next')}
            </button>
          </div>
        </div>

        {step.aside && (
          <aside className="hidden min-w-0 flex-[1_1_340px] flex-col gap-4 lg:flex">
            {step.aside}
          </aside>
        )}
      </div>
    </form>
  );
}
