import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * For a field the form changes, what it was: its former value as read, or
 * null when it has none to show (a description); undefined for a field that
 * keeps its value.
 */
export type PreviousValue = (field: string) => string | null | undefined;

const PreviousValueContext = createContext<PreviousValue | undefined>(undefined);

/**
 * Gives the steps the former values, when an admin changes the settings of a
 * challenge; the creation has none, and shows no pill.
 */
export const PreviousValueProvider = PreviousValueContext.Provider;

/** "Modifié · avant : 3 km" beside a field the form changes. */
export function ChangedPill({ field, className = '' }: { field: string; className?: string }) {
  const { t } = useTranslation();
  const previous = useContext(PreviousValueContext)?.(field);
  if (previous === undefined) return null;
  return (
    <span
      className={`${className} inline-block rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent`}
    >
      {previous === null
        ? t('admin.settings.changed')
        : t('admin.settings.changedFrom', { before: previous })}
    </span>
  );
}
