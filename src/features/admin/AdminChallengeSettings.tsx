import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { FormProvider, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../api/errors';
import {
  updateAdminChallenge,
  useAdminChallenge,
  type AdminChallengeDetail,
  type AdminChallengeSettingsUpdate,
} from '../../api/hooks/admin/useAdminChallenges';
import type { CorrectionBody } from '../../api/hooks/admin/useAdminCorrection';
import type { ApiClient } from '../../api/client';
import { useSports } from '../../api/hooks/useSports';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import {
  changedSettings,
  settingsFormValues,
  settingsUpdate,
} from '../../domain/adminChallengeSettings';
import { isChallengeId } from '../../domain/challenge';
import { formFieldOf, type CatalogueSport } from '../../domain/challengeCreate';
import {
  challengeCreateSchema,
  MAX_FACTOR,
  MAX_WEEKS,
  MIN_FACTOR,
  MIN_WEEKS,
  type ChallengeCreateInput,
  type ChallengeCreateValues,
} from '../../domain/schemas/challenge';
import { CategoriesStep } from '../challenges/create/CategoriesStep';
import { PreviousValueProvider } from '../challenges/create/ChangedPill';
import { DurationStep } from '../challenges/create/DurationStep';
import { InfoStep } from '../challenges/create/InfoStep';
import { RecomputeFlow } from './RecomputeFlow';
import { useSettingsChanges } from './useSettingsChanges';

const CARD = 'rounded-card border border-border bg-surface p-4 lg:p-6';
const sheetPath = (challengeId: string) => `/admin/challenges/${encodeURIComponent(challengeId)}`;

/**
 * An admin changes any setting of a challenge (mockup « Modifier les
 * réglages d'un défi »): the creation's fields, filled with the challenge's
 * settings and checked by the same rules, but the first day, which may be
 * past. Then the preview of the recompute, and the reason. Tests give `now`
 * and the offered time zones.
 */
export function AdminChallengeSettings({
  now,
  timeZones,
}: {
  now?: Date;
  timeZones?: readonly string[];
}) {
  const { t } = useTranslation();
  const { challengeId } = useParams();
  const valid = isChallengeId(challengeId);
  // An address that cannot be a challenge asks nothing of the server.
  const challenge = useAdminChallenge(valid ? challengeId : '', valid);
  const sports = useSports();

  let content: ReactNode;
  if (
    !valid ||
    (challenge.error instanceof ApiError && challenge.error.code === 'challenge_not_found')
  ) {
    content = <p className={`${CARD} text-muted`}>{t('admin.challenges.notFound')}</p>;
  } else if (challenge.isPending || sports.isPending) {
    content = <LoadingState />;
  } else if (!challenge.data) {
    // Only with nothing loaded: a failed refresh keeps the form and its
    // changes, and the global banner says so.
    content = <ErrorState error={challenge.error} onRetry={() => void challenge.refetch()} />;
  } else if (!sports.data) {
    content = <ErrorState error={sports.error} onRetry={() => void sports.refetch()} />;
  } else if (challenge.data.deleted_at !== null) {
    // The server refuses to change a deleted challenge: it is restored first.
    content = <p className={`${CARD} text-muted`}>{t('admin.settings.deleted')}</p>;
  } else {
    content = (
      <SettingsForm
        challenge={challenge.data}
        sports={sports.data}
        now={now}
        timeZones={timeZones}
      />
    );
  }
  return (
    <div className="mt-6 flex flex-col gap-6">
      {valid ? (
        <Link
          to={sheetPath(challengeId)}
          className="-ml-2 inline-flex h-11 min-w-0 items-center gap-2 self-start rounded-tab px-2 font-semibold hover-fill"
        >
          <ArrowLeft aria-hidden="true" size={18} className="flex-none" />
          <span className="truncate">{challenge.data?.title ?? t('admin.settings.back')}</span>
        </Link>
      ) : (
        <Link
          to="/admin/challenges"
          className="-ml-2 inline-flex h-11 items-center gap-2 self-start rounded-tab px-2 font-semibold hover-fill"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          {t('admin.challenges.back')}
        </Link>
      )}
      {content}
    </div>
  );
}

function SettingsForm({
  challenge,
  sports,
  now: givenNow,
  timeZones: givenTimeZones,
}: {
  challenge: AdminChallengeDetail;
  sports: readonly CatalogueSport[];
  now?: Date;
  timeZones?: readonly string[];
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const number = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'fr');
  // "Today" is the page's opening day: the server checks the date again.
  const [now] = useState(() => givenNow ?? new Date());
  // Read once: the picker's labels cost one Intl format per zone.
  // The challenge's own is offered too, though the device may not list it.
  const [timeZones] = useState(() => {
    const zones = givenTimeZones ?? Intl.supportedValuesOf('timeZone');
    return zones.includes(challenge.timezone) ? zones : [...zones, challenge.timezone];
  });
  // The settings as they were on opening: a later read of the challenge
  // leaves the fields as the admin set them.
  const [initial] = useState(() => settingsFormValues(challenge));
  const form = useForm<ChallengeCreateInput, unknown, ChallengeCreateValues>({
    resolver: zodResolver(challengeCreateSchema(now, { pastStart: true })),
    // Checked once the field is left, then at each keystroke.
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: initial,
  });
  // Every field, as entered: what changes is read at each keystroke.
  const values = useWatch({ control: form.control, compute: (all) => all });
  const changed = changedSettings(initial, values, sports);
  const { changes, previous } = useSettingsChanges(initial, values, changed, sports);
  // The request, set once the fields are valid, read when it is sent.
  const update = useRef<AdminChallengeSettingsUpdate>({});
  // A field was refused on "See the preview", until the next try.
  const [invalid, setInvalid] = useState(false);

  // validation_failed names the refused fields: each shows an error where it
  // is entered, back from the preview or the reason.
  const send = async (client: ApiClient, body: CorrectionBody) => {
    try {
      return await updateAdminChallenge(client, challenge.id, update.current, body);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'validation_failed') {
        for (const field of (error.params.fields ?? '').split(',').map(formFieldOf)) {
          // formFieldOf only gives fields of this form: the cast names its
          // type, it adds none.
          if (field) {
            form.setError(field as FieldPath<ChallengeCreateInput>, {
              message: 'admin.settings.serverInvalid',
            });
          }
        }
      }
      throw error;
    }
  };

  const summary = changes
    .map(({ label, before, after }) =>
      before === null || after === null
        ? t('admin.settings.rowChanged', { label })
        : t('admin.settings.row', { label, before, after }),
    )
    .join(' · ');

  return (
    <RecomputeFlow
      change={{
        title: t('admin.settings.change', { title: challenge.title }),
        details: summary || undefined,
      }}
      reasonTitle={t('admin.settings.reasonTitle')}
      confirmLabel={t('admin.settings.confirm')}
      send={send}
      onDone={() => void navigate(sheetPath(challenge.id))}
    >
      {({ showPreview, pending, error }) => (
        <FormProvider {...form}>
          <PreviousValueProvider value={previous}>
            <form
              noValidate
              aria-labelledby="admin-settings-title"
              onSubmit={(event) => {
                // Nothing to preview: the button says so, Enter in a field too.
                if (changes.length === 0) {
                  event.preventDefault();
                  return;
                }
                void form.handleSubmit(
                  (valid) => {
                    setInvalid(false);
                    update.current = settingsUpdate(initial, valid, sports);
                    showPreview();
                  },
                  () => setInvalid(true),
                )(event);
              }}
              className="flex flex-col gap-6"
            >
              <h2 id="admin-settings-title" className="font-display text-2xl font-bold md:text-3xl">
                {t('admin.settings.title')}
              </h2>
              <p
                role="note"
                className="flex gap-3 rounded-card border border-risk-border bg-risk-bg p-4 text-risk-fg"
              >
                <AlertTriangle aria-hidden="true" size={20} className="mt-0.5 flex-none" />
                <span>
                  <Trans
                    i18nKey={`admin.settings.warning.${challenge.status}`}
                    components={{ b: <strong /> }}
                  />{' '}
                  {t('admin.settings.bounds', {
                    minWeeks: MIN_WEEKS,
                    maxWeeks: MAX_WEEKS,
                    minFactor: number.format(MIN_FACTOR),
                    maxFactor: number.format(MAX_FACTOR),
                  })}
                </span>
              </p>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                <div className="flex min-w-0 flex-col gap-6">
                  <Section id="info" title={t('admin.settings.sections.info')}>
                    <InfoStep />
                  </Section>
                  <Section id="dates" title={t('admin.settings.sections.dates')}>
                    <DurationStep now={now} timeZones={timeZones} pastStart />
                  </Section>
                  <Section id="categories" title={t('admin.settings.sections.categories')}>
                    <CategoriesStep sportsWaiting={false} />
                  </Section>
                </div>
                <div className="flex flex-col gap-4 lg:sticky lg:top-6">
                  <Changes changes={changes} />
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={sheetPath(challenge.id)}
                      className="inline-flex h-13 items-center rounded-full border border-border bg-surface px-6 font-bold hover-fill"
                    >
                      {t('admin.settings.cancel')}
                    </Link>
                    <button
                      type="submit"
                      disabled={pending}
                      // aria-disabled, not disabled: the focus stays, and the
                      // reason is read from the changes' card.
                      aria-disabled={changes.length === 0 ? true : undefined}
                      aria-describedby={changes.length === 0 ? 'settings-no-change' : undefined}
                      className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 text-button font-bold text-on-accent hover-accent disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                    >
                      {pending ? t('admin.settings.previewBusy') : t('admin.settings.preview')}
                      {!pending && <ArrowRight aria-hidden="true" size={20} />}
                    </button>
                  </div>
                  {/* Beside the button: the fields may be far up the page. */}
                  {(invalid || error) && (
                    <p role="alert" className="text-sm text-risk-fg">
                      {invalid ? t('admin.settings.invalid') : error}
                    </p>
                  )}
                </div>
              </div>
            </form>
          </PreviousValueProvider>
        </FormProvider>
      )}
    </RecomputeFlow>
  );
}

/** A card of the form, titled. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`settings-${id}`} className={CARD}>
      <h3 id={`settings-${id}`} className="mb-6 font-display text-xl font-bold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The settings changed so far, before and after. What the change judges
 * again is the server's to say, in the preview.
 */
function Changes({ changes }: { changes: ReturnType<typeof useSettingsChanges>['changes'] }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-changes" className={CARD}>
      <h3 id="settings-changes" className="font-display text-xl font-bold">
        {t('admin.settings.changes', { count: changes.length })}
      </h3>
      {changes.length === 0 ? (
        <p id="settings-no-change" className="mt-3 text-muted">
          {t('admin.settings.noChange')}
        </p>
      ) : (
        <dl className="mt-3 flex flex-col divide-y divide-border border-t border-border">
          {changes.map(({ field, label, before, after }) => (
            <div key={field} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
              <dt>{label}</dt>
              <dd className="font-bold break-words">
                {before === null || after === null ? (
                  t('admin.settings.changed')
                ) : (
                  <>
                    {before} <span aria-hidden="true">→</span>
                    <span className="sr-only">{t('admin.settings.to')}</span> {after}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-sm text-muted">{t('admin.settings.previewNote')}</p>
    </section>
  );
}
