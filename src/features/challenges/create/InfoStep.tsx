import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';

const inputClass =
  'mt-2 w-full rounded-row border border-border bg-surface px-3 text-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-risk-fg';

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  const { t } = useTranslation();
  return message ? (
    <p id={id} role="alert" className="mt-1 text-sm text-risk-fg">
      {t(message)}
    </p>
  ) : null;
}

// Hint first, then the error once there is one.
function describedBy(name: string, message: string | undefined): string {
  return message ? `${name}-hint ${name}-error` : `${name}-hint`;
}

/** Step 1 of the creation: title, description, visibility, who may invite. */
export function InfoStep() {
  const { t } = useTranslation();
  const {
    register,
    formState: { errors },
  } = useFormContext<ChallengeCreateInput>();
  const titleError = errors.title?.message;
  const descriptionError = errors.description?.message;
  const visibilityError = errors.visibility?.message;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor="title" className="block text-sm font-semibold">
          {t('challengeCreate.fields.title.label')}
        </label>
        <input
          id="title"
          autoComplete="off"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={describedBy('title', titleError)}
          className={`${inputClass} h-11`}
          {...register('title')}
        />
        <p id="title-hint" className="mt-1 text-sm text-muted">
          {t('challengeCreate.fields.title.hint')}
        </p>
        <FieldError id="title-error" message={titleError} />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-semibold">
          {t('challengeCreate.fields.description.label')}
        </label>
        <textarea
          id="description"
          rows={4}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={describedBy('description', descriptionError)}
          className={`${inputClass} py-2`}
          {...register('description')}
        />
        <p id="description-hint" className="mt-1 text-sm text-muted">
          {t('challengeCreate.fields.description.hint')}
        </p>
        <FieldError id="description-error" message={descriptionError} />
      </div>

      <fieldset aria-describedby={visibilityError ? 'visibility-error' : undefined}>
        <legend className="text-sm font-semibold">
          {t('challengeCreate.fields.visibility.label')}
        </legend>
        <div className="mt-2 flex flex-col gap-3">
          {(['private', 'public'] as const).map((visibility) => (
            <div
              key={visibility}
              className="rounded-row border border-border bg-surface px-3 pb-3 has-[:checked]:border-2 has-[:checked]:border-accent"
            >
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input
                  type="radio"
                  value={visibility}
                  aria-invalid={visibilityError ? true : undefined}
                  aria-describedby={`visibility-${visibility}-hint`}
                  {...register('visibility')}
                />
                {t(`challengeCreate.fields.visibility.${visibility}`)}
              </label>
              <p id={`visibility-${visibility}-hint`} className="pl-7 text-sm text-muted">
                {t(`challengeCreate.fields.visibility.${visibility}Hint`)}
              </p>
            </div>
          ))}
        </div>
        <FieldError id="visibility-error" message={visibilityError} />
      </fieldset>

      <div className="rounded-row border border-border bg-surface px-3 pb-3">
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            aria-describedby="members-can-invite-hint"
            {...register('members_can_invite')}
          />
          {t('challengeCreate.fields.membersCanInvite.label')}
        </label>
        <p id="members-can-invite-hint" className="pl-7 text-sm text-muted">
          {t('challengeCreate.fields.membersCanInvite.hint')}
        </p>
      </div>
    </div>
  );
}
