import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Wizard } from '../../../components/Wizard';
import {
  challengeCreateSchema,
  type ChallengeCreateInput,
  type ChallengeCreateValues,
} from '../../../domain/schemas/challenge';
import { DurationStep } from './DurationStep';
import { InfoStep } from './InfoStep';
import { useLeaveWarning } from './useLeaveWarning';

// Fields checked before leaving each step, in step order.
const STEP_FIELDS = [
  ['title', 'description', 'visibility', 'members_can_invite'],
  ['weeks', 'start_date', 'timezone'],
] as const;

// Montréal's time zone (IANA names it after Toronto): the product's default.
const DEFAULT_TIME_ZONE = 'America/Toronto';

/**
 * Challenge creation in steps, over one form: a step keeps its input when
 * the user goes back, and leaving with unsent input asks first. The time
 * zone starts as Montréal's, whatever the device's. Tests give `now` and the
 * offered time zones.
 */
export function ChallengeCreateWizard({
  now: givenNow,
  timeZones: givenTimeZones,
}: {
  now?: Date;
  timeZones?: readonly string[];
}) {
  const { t } = useTranslation();
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
    },
  });
  // Not `isDirty`: under StrictMode the double mount sets it for the radios
  // without a default (null against undefined); the changed fields are exact.
  const blocker = useLeaveWarning(Object.keys(form.formState.dirtyFields).length > 0);

  const validateStep = (index: number) => {
    const fields = STEP_FIELDS[index];
    return fields ? form.trigger(fields, { shouldFocus: true }) : Promise.resolve(true);
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
        ]}
        validateStep={validateStep}
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
