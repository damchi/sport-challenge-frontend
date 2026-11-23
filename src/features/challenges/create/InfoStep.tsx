import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { FieldError } from './FieldError';
import { choiceCardClass, describedBy, inputClass } from './fields';
import { Switch } from './Switch';

// Longest title the contract takes, shown by the counter.
const TITLE_MAX = 80;

/** Step 1 of the creation: title, description, visibility, who may invite. */
export function InfoStep() {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ChallengeCreateInput>();
  const title = useWatch({ control, name: 'title' });
  const titleError = errors.title?.message;
  const descriptionError = errors.description?.message;
  const visibilityError = errors.visibility?.message;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <label htmlFor="title" className="block font-semibold">
          {t('challengeCreate.fields.title.label')}
        </label>
        <input
          id="title"
          autoComplete="off"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={describedBy('title', titleError)}
          className={`${inputClass} h-13 w-full`}
          {...register('title')}
        />
        <div className="mt-2 flex justify-between gap-3 text-sm text-muted">
          <p id="title-hint">{t('challengeCreate.fields.title.hint')}</p>
          {/* The hint gives the bound: the count is for the eye only. */}
          <p aria-hidden="true" className="tabular-nums">
            {t('challengeCreate.fields.title.count', { count: title.length, max: TITLE_MAX })}
          </p>
        </div>
        <FieldError id="title-error" message={titleError} />
      </div>

      <div>
        <label htmlFor="description" className="block font-semibold">
          {t('challengeCreate.fields.description.label')}
        </label>
        <textarea
          id="description"
          rows={4}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={describedBy('description', descriptionError)}
          className={`${inputClass} w-full py-3`}
          {...register('description')}
        />
        <p id="description-hint" className="mt-2 text-sm text-muted">
          {t('challengeCreate.fields.description.hint')}
        </p>
        <FieldError id="description-error" message={descriptionError} />
      </div>

      <fieldset aria-describedby={visibilityError ? 'visibility-error' : undefined}>
        <legend className="font-semibold">{t('challengeCreate.fields.visibility.label')}</legend>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(['private', 'public'] as const).map((visibility) => (
            <label key={visibility} className={choiceCardClass}>
              <input
                type="radio"
                value={visibility}
                aria-invalid={visibilityError ? true : undefined}
                aria-labelledby={`visibility-${visibility}-label`}
                aria-describedby={`visibility-${visibility}-hint`}
                className="mt-0.5 size-5 flex-none accent-accent"
                {...register('visibility')}
              />
              <span>
                <span id={`visibility-${visibility}-label`} className="block font-bold">
                  {t(`challengeCreate.fields.visibility.${visibility}`)}
                </span>
                <span id={`visibility-${visibility}-hint`} className="mt-1 block text-muted">
                  {t(`challengeCreate.fields.visibility.${visibility}Hint`)}
                </span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="visibility-error" message={visibilityError} />
      </fieldset>

      <label className="flex items-center gap-4 rounded-row border border-border bg-surface p-4">
        <span className="min-w-0 flex-1">
          <span id="members-can-invite-label" className="block font-bold">
            {t('challengeCreate.fields.membersCanInvite.label')}
          </span>
          <span id="members-can-invite-hint" className="mt-1 block text-muted">
            {t('challengeCreate.fields.membersCanInvite.hint')}
          </span>
        </span>
        <Switch
          aria-labelledby="members-can-invite-label"
          aria-describedby="members-can-invite-hint"
          {...register('members_can_invite')}
        />
      </label>
    </div>
  );
}
