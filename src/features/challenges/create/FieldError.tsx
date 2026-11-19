import { useTranslation } from 'react-i18next';

/** A field's error, translated from the schema's key and announced. */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  const { t } = useTranslation();
  return message ? (
    <p id={id} role="alert" className="mt-1 text-sm text-risk-fg">
      {t(message)}
    </p>
  ) : null;
}
