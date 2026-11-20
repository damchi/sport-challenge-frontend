import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useUpdateMe, type Me } from '../../api/hooks/useMe';
import { pseudoSchema, pseudoUpdate, type PseudoInput } from '../../domain/schemas/profile';
import { fieldErrors } from './profileErrors';

/**
 * The pseudo, set, changed or removed (emptied) from the profile page, with
 * the onboarding's rules and errors. Without it, others see the first and
 * last name.
 */
export function PseudoForm({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const [formError, setFormError] = useState<string>();
  // What the last save did, said in the status line.
  const [saved, setSaved] = useState<'saved' | 'removed'>();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PseudoInput>({
    resolver: zodResolver(pseudoSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { pseudo: me.pseudo ?? '' },
  });
  const pseudo = useWatch({ control, name: 'pseudo' });
  const unchanged = pseudo.trim() === (me.pseudo ?? '');

  const onSubmit = async ({ pseudo: value }: PseudoInput) => {
    setFormError(undefined);
    setSaved(undefined);
    try {
      await updateMe.mutateAsync(pseudoUpdate(value, me.pseudo));
      setSaved(value === '' ? 'removed' : 'saved');
    } catch (error) {
      const invalid = fieldErrors(error).find(([field]) => field === 'pseudo');
      if (invalid) {
        setError('pseudo', { message: invalid[1] }, { shouldFocus: true });
      } else {
        const { key, values } =
          error instanceof ApiError
            ? errorMessage(error, (candidate) => i18n.exists(candidate))
            : { key: 'errors.unknown', values: {} };
        setFormError(t(key, values));
      }
    }
  };

  const message = errors.pseudo?.message;
  const describedBy = ['profile-pseudo-hint', message && 'profile-pseudo-error']
    .filter(Boolean)
    .join(' ');

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="mt-6"
      aria-labelledby="profile-pseudo-label"
    >
      <label
        id="profile-pseudo-label"
        htmlFor="profile-pseudo"
        className="block text-sm font-semibold"
      >
        {t('onboarding.pseudo.label')}
      </label>
      <div className="mt-2 flex gap-3">
        <input
          id="profile-pseudo"
          autoComplete="nickname"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
          className="h-11 min-w-0 flex-1 rounded-row border border-border bg-surface px-3 text-ink"
          {...register('pseudo', { onChange: () => setSaved(undefined) })}
        />
        <button
          type="submit"
          disabled={isSubmitting || unchanged}
          aria-busy={isSubmitting}
          className="h-11 rounded-full bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-60"
        >
          {isSubmitting ? t('onboarding.saving') : t('profile.save')}
        </button>
      </div>
      <p id="profile-pseudo-hint" className="mt-1 text-sm text-muted">
        {t('onboarding.pseudo.hint')}
      </p>
      {message && (
        <p id="profile-pseudo-error" role="alert" className="mt-1 text-sm text-risk-fg">
          {t(message)}
        </p>
      )}
      {formError && (
        <p role="alert" className="mt-1 text-sm text-risk-fg">
          {formError}
        </p>
      )}
      <p role="status" className="mt-1 text-sm text-muted">
        {saved && t(`profile.pseudoForm.${saved}`)}
      </p>
    </form>
  );
}
