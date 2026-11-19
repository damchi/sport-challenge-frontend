import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, type FieldErrors, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../../../api/errors';
import { useCreateChallenge } from '../../../api/hooks/useChallenges';
import { useSports } from '../../../api/hooks/useSports';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Wizard } from '../../../components/Wizard';
import { challengeCreateRequest, formFieldOf } from '../../../domain/challengeCreate';
import {
  challengeCreateSchema,
  type ChallengeCreateInput,
  type ChallengeCreateValues,
} from '../../../domain/schemas/challenge';
import { CategoriesStep } from './CategoriesStep';
import { DurationStep } from './DurationStep';
import { InfoStep } from './InfoStep';
import { RecapStep } from './RecapStep';
import { useLeaveWarning } from './useLeaveWarning';
import { useSportName } from './useSportName';

// Fields checked before leaving each step, in step order; the recap sends the
// whole form, checked once more.
const STEP_FIELDS = [
  ['title', 'description', 'visibility', 'members_can_invite'],
  ['weeks', 'start_date', 'timezone'],
  ['elimination_step_km', 'factors'],
] as const;

// Translation key of the label of each field, for the refused ones.
const FIELD_LABELS: Record<string, string> = {
  title: 'challengeCreate.fields.title.label',
  description: 'challengeCreate.recap.description',
  visibility: 'challengeCreate.fields.visibility.label',
  members_can_invite: 'challengeCreate.recap.invitations',
  weeks: 'challengeCreate.fields.weeks.label',
  start_date: 'challengeCreate.fields.startDate.label',
  timezone: 'challengeCreate.fields.timezone.label',
  elimination_step_km: 'challengeCreate.fields.eliminationStep.label',
};

// Montréal's time zone (IANA names it after Toronto): the product's default.
const DEFAULT_TIME_ZONE = 'America/Toronto';

/**
 * Challenge creation in steps, over one form: a step keeps its input when
 * the user goes back, and leaving with unsent input asks first. The time
 * zone starts as Montréal's, whatever the device's. The recap sends it; once
 * created, the challenge's page opens. Tests give `now` and the offered time
 * zones.
 */
export function ChallengeCreateWizard({
  now: givenNow,
  timeZones: givenTimeZones,
}: {
  now?: Date;
  timeZones?: readonly string[];
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const sportName = useSportName();
  const sports = useSports();
  const createChallenge = useCreateChallenge();
  const [createdId, setCreatedId] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  // Next was pressed before the factors could be shown.
  const [factorsWaiting, setFactorsWaiting] = useState(false);
  // Set at once, unlike the mutation's state: a second click in the same
  // instant sends nothing.
  const sending = useRef(false);
  // "Today" is the page's opening day: the server checks the date again.
  const [now] = useState(() => givenNow ?? new Date());
  // Read once: the picker's labels cost one Intl format per zone.
  const [timeZones] = useState(() => givenTimeZones ?? Intl.supportedValuesOf('timeZone'));
  const form = useForm<ChallengeCreateInput, unknown, ChallengeCreateValues>({
    resolver: zodResolver(challengeCreateSchema(now)),
    // Checked once the field is left, then at each keystroke.
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      members_can_invite: false,
      start_date: '',
      timezone: DEFAULT_TIME_ZONE,
      factors: {},
    },
  });
  // Not `isDirty`: under StrictMode the double mount sets it for the radios
  // without a default (null against undefined); the changed fields are exact.
  // Once created, nothing is left to lose.
  const blocker = useLeaveWarning(
    createdId === undefined && Object.keys(form.formState.dirtyFields).length > 0,
  );

  // After the render that lifted the leave warning, so it does not block.
  useEffect(() => {
    if (createdId) void navigate(`/challenges/${encodeURIComponent(createdId)}`, { replace: true });
  }, [createdId, navigate]);

  const label = (field: string) =>
    field.startsWith('factors.')
      ? sportName(field.slice('factors.'.length))
      : t(FIELD_LABELS[field] ?? field);

  // The recap checks the whole form once more: a value refused at that point
  // (the steps let none through, so a safety net) is named, never silent.
  const showInvalid = (errors: FieldErrors<ChallengeCreateInput>) => {
    const fields = Object.keys(errors).flatMap((field) =>
      field === 'factors'
        ? Object.keys(errors.factors ?? {}).map((code) => `factors.${code}`)
        : [field],
    );
    setSubmitError(t('challengeCreate.submit.check', { fields: fields.map(label).join(', ') }));
  };

  // validation_failed names the refused fields: each shows an error where it
  // is entered, and the recap lists them.
  const showError = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'validation_failed') {
      const fields = (error.params.fields ?? '')
        .split(',')
        .map(formFieldOf)
        .filter((field): field is string => field !== undefined);
      for (const field of fields) {
        form.setError(field as FieldPath<ChallengeCreateInput>, {
          message: 'challengeCreate.fields.serverInvalid',
        });
      }
      if (fields.length > 0) {
        setSubmitError(
          t('challengeCreate.submit.invalid', { fields: fields.map(label).join(', ') }),
        );
        return;
      }
    }
    const { key, values } =
      error instanceof ApiError
        ? errorMessage(error, (candidate) => i18n.exists(candidate))
        : { key: 'errors.unknown', values: {} };
    setSubmitError(t(key, values));
  };

  const create = async (values: ChallengeCreateValues) => {
    if (sending.current) return;
    sending.current = true;
    setSubmitError(undefined);
    try {
      const challenge = await createChallenge.mutateAsync(
        challengeCreateRequest(values, sports.data ?? []),
      );
      // Created: the guard stays up until the page changes.
      setCreatedId(challenge.id);
    } catch (error) {
      showError(error);
      sending.current = false;
    }
  };

  const validateStep = async (index: number) => {
    const fields = STEP_FIELDS[index];
    const valid = fields ? await form.trigger(fields, { shouldFocus: true }) : true;
    // The factors are seen before going on: not while the catalogue is
    // loading or failed. The step then says why it stays.
    if (fields?.some((field) => field === 'factors') && !sports.isSuccess) {
      setFactorsWaiting(true);
      return false;
    }
    return valid;
  };

  return (
    <FormProvider {...form}>
      <Wizard
        steps={[
          { title: t('challengeCreate.steps.info'), content: <InfoStep /> },
          {
            title: t('challengeCreate.steps.duration'),
            content: <DurationStep now={now} timeZones={timeZones} />,
          },
          {
            title: t('challengeCreate.steps.categories'),
            content: <CategoriesStep factorsWaiting={factorsWaiting} />,
          },
          {
            title: t('challengeCreate.steps.recap'),
            content: <RecapStep now={now} error={submitError} />,
          },
        ]}
        validateStep={validateStep}
        finish={{
          label: t('challengeCreate.submit.label'),
          busyLabel: t('challengeCreate.submit.busy'),
          busy: createChallenge.isPending || createdId !== undefined,
          onFinish: () => void form.handleSubmit(create, showInvalid)(),
        }}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={t('challengeCreate.leave.title')}
        message={t('challengeCreate.leave.message')}
        confirmLabel={t('challengeCreate.leave.confirm')}
        cancelLabel={t('challengeCreate.leave.cancel')}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </FormProvider>
  );
}
