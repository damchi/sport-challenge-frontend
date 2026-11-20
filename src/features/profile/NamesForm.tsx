import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useUpdateMe, type Me } from '../../api/hooks/useMe';
import { namesSchema, type NamesInput } from '../../domain/schemas/profile';
import { NameInput } from './NameInput';
import { fieldErrors, type NAME_FIELDS } from './profileErrors';

/**
 * The first and last name, changed from the profile page with the
 * onboarding's rules and errors. Both stay required: they can be changed,
 * never removed.
 */
export function NamesForm({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NamesInput>({
    resolver: zodResolver(namesSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { first_name: me.first_name ?? '', last_name: me.last_name ?? '' },
  });
  const [firstName, lastName] = useWatch({ control, name: ['first_name', 'last_name'] });
  const unchanged =
    firstName.trim() === (me.first_name ?? '') && lastName.trim() === (me.last_name ?? '');

  const onSubmit = async (names: NamesInput) => {
    setFormError(undefined);
    setSaved(false);
    try {
      await updateMe.mutateAsync(names);
      setSaved(true);
    } catch (error) {
      const invalid = fieldErrors(error).filter(
        (entry): entry is [(typeof NAME_FIELDS)[number], string] => entry[0] !== 'pseudo',
      );
      if (invalid.length > 0) {
        invalid.forEach(([field, message], index) =>
          setError(field, { message }, { shouldFocus: index === 0 }),
        );
      } else {
        const { key, values } =
          error instanceof ApiError
            ? errorMessage(error, (candidate) => i18n.exists(candidate))
            : { key: 'errors.unknown', values: {} };
        setFormError(t(key, values));
      }
    }
  };

  const onChange = () => setSaved(false);

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-4"
    >
      <NameInput
        name="first_name"
        label={t('onboarding.firstName')}
        autoComplete="given-name"
        message={errors.first_name?.message}
        registration={register('first_name', { onChange })}
      />
      <NameInput
        name="last_name"
        label={t('onboarding.lastName')}
        autoComplete="family-name"
        message={errors.last_name?.message}
        registration={register('last_name', { onChange })}
      />
      {formError && (
        <p role="alert" className="text-sm text-risk-fg">
          {formError}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || unchanged}
          aria-busy={isSubmitting}
          className="h-11 rounded-full bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-60"
        >
          {isSubmitting ? t('onboarding.saving') : t('profile.save')}
        </button>
        <p role="status" className="text-sm text-muted">
          {saved && t('profile.namesForm.saved')}
        </p>
      </div>
    </form>
  );
}
