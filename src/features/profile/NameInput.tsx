import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { NAME_FIELDS } from './profileErrors';

/** A required first or last name, its error read with the field. */
export function NameInput({
  name,
  label,
  autoComplete,
  message,
  registration,
}: {
  name: (typeof NAME_FIELDS)[number];
  label: string;
  autoComplete: string;
  message: string | undefined;
  registration: UseFormRegisterReturn;
}) {
  const { t } = useTranslation();
  const errorId = `${name}-error`;
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        autoComplete={autoComplete}
        aria-required="true"
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        className="mt-2 h-11 w-full rounded-row border border-border bg-surface px-3 text-ink"
        {...registration}
      />
      {message && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-risk-fg">
          {t(message)}
        </p>
      )}
    </div>
  );
}
