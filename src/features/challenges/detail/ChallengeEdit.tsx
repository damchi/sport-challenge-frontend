import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../../api/errors';
import { useUpdateChallenge, type ChallengeDetail } from '../../../api/hooks/useChallenges';
import { challengePeriod, otherTimeZoneName } from '../../../domain/format/challengeDates';
import {
  challengeUpdateSchema,
  type ChallengeUpdateInput,
} from '../../../domain/schemas/challenge';
import { FieldError } from '../create/FieldError';
import { describedBy, inputClass } from '../create/fields';
import { useCategoryName } from './categoryNames';

const EDIT_FIELDS = ['title', 'description'] as const;

function isEditField(field: string): field is (typeof EDIT_FIELDS)[number] {
  return (EDIT_FIELDS as readonly string[]).includes(field);
}

/**
 * Edition of a challenge's title and description, for its creators (the
 * server's role), at any time, opened from the page's menu (`open`). The
 * rest is frozen at creation: the form says so and shows the dates (with the
 * challenge's zone when the user's differs), the visibility and the
 * categories read only. Saved or cancelled, `onClose` gives the focus back.
 */
export function ChallengeEdit({
  challenge,
  open,
  onClose,
}: {
  challenge: ChallengeDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  // A new edition: the previous confirmation goes away.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSaved(false);
  }

  if (challenge.my_role !== 'creator') return null;

  return (
    <div className="mt-4">
      {open && (
        <ChallengeEditForm
          challenge={challenge}
          onClose={(didSave) => {
            setSaved(didSave);
            onClose();
          }}
        />
      )}
      <p role="status" className="mt-1 text-sm text-muted">
        {saved && t('challengeDetail.edit.saved')}
      </p>
    </div>
  );
}

function ChallengeEditForm({
  challenge,
  onClose,
}: {
  challenge: ChallengeDetail;
  onClose: (saved: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const update = useUpdateChallenge(challenge.id);
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ChallengeUpdateInput>({
    resolver: zodResolver(challengeUpdateSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { title: challenge.title, description: challenge.description ?? '' },
  });
  const locale = i18n.resolvedLanguage ?? 'fr';
  const period = challengePeriod(
    challenge.starts_at,
    challenge.ends_at,
    challenge.timezone,
    locale,
  );
  const zone = otherTimeZoneName(
    challenge.timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );
  const categoryName = useCategoryName(challenge.reference_sport);
  const categories = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    [...challenge.categories]
      .sort((a, b) => a.position - b.position)
      .map((category) => categoryName(category.type)),
  );

  useEffect(() => {
    setFocus('title');
  }, [setFocus]);

  const onSubmit = async (values: ChallengeUpdateInput) => {
    setFormError(undefined);
    try {
      await update.mutateAsync(values);
      onClose(true);
    } catch (error) {
      // validation_failed names the refused fields: each shows its error.
      const fields =
        error instanceof ApiError && error.code === 'validation_failed'
          ? (error.params.fields ?? '').split(',').filter(isEditField)
          : [];
      fields.forEach((field, index) =>
        setError(
          field,
          { message: 'challengeDetail.edit.serverInvalid' },
          { shouldFocus: index === 0 },
        ),
      );
      if (fields.length > 0) return;
      const { key, values: params } =
        error instanceof ApiError
          ? errorMessage(error, (candidate) => i18n.exists(candidate))
          : { key: 'errors.unknown', values: {} };
      setFormError(t(key, params));
    }
  };

  const titleError = errors.title?.message;
  const descriptionError = errors.description?.message;

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      aria-labelledby="edit-heading"
      className="flex flex-col gap-6 rounded-row border border-border bg-surface p-4 md:max-w-xl"
    >
      <h2 id="edit-heading" className="text-lg font-bold">
        {t('challengeDetail.edit.heading')}
      </h2>

      <div>
        <label htmlFor="edit-title" className="block text-sm font-semibold">
          {t('challengeCreate.fields.title.label')}
        </label>
        <input
          id="edit-title"
          autoComplete="off"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={describedBy('edit-title', titleError)}
          className={`${inputClass} h-11 w-full`}
          {...register('title')}
        />
        <p id="edit-title-hint" className="mt-1 text-sm text-muted">
          {t('challengeCreate.fields.title.hint')}
        </p>
        <FieldError id="edit-title-error" message={titleError} />
      </div>

      <div>
        <label htmlFor="edit-description" className="block text-sm font-semibold">
          {t('challengeCreate.fields.description.label')}
        </label>
        <textarea
          id="edit-description"
          rows={4}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={describedBy('edit-description', descriptionError)}
          className={`${inputClass} w-full py-2`}
          {...register('description')}
        />
        <p id="edit-description-hint" className="mt-1 text-sm text-muted">
          {t('challengeDetail.edit.descriptionHint')}
        </p>
        <FieldError id="edit-description-error" message={descriptionError} />
      </div>

      <div>
        <p className="text-sm text-muted">{t('challengeDetail.edit.frozen')}</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold">{t('challengeDetail.edit.dates')}</dt>
          <dd>
            {t('challenges.period', period)}
            {zone && (
              <span className="block text-muted">{t('challengeDetail.timeZone', { zone })}</span>
            )}
          </dd>
          <dt className="font-semibold">{t('challengeDetail.edit.visibility')}</dt>
          <dd>{t(`challenges.visibility.${challenge.visibility}`)}</dd>
          <dt className="font-semibold">{t('challengeDetail.edit.categories')}</dt>
          <dd>{categories}</dd>
        </dl>
      </div>

      {formError && (
        <p role="alert" className="text-sm font-semibold text-risk-fg">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="h-11 rounded-full bg-accent hover-accent px-6 text-sm font-bold text-on-accent disabled:opacity-60"
        >
          {isSubmitting ? t('challengeDetail.edit.saving') : t('challengeDetail.edit.save')}
        </button>
        <button
          type="button"
          onClick={() => onClose(false)}
          className="h-11 rounded-full border border-border bg-surface hover-fill px-6 text-sm font-bold"
        >
          {t('challengeDetail.edit.cancel')}
        </button>
      </div>
    </form>
  );
}
