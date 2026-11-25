import { ArrowLeft, Shield } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  sendAdminActivityChange,
  type AdminActivityFields,
} from '../../api/hooks/admin/adminActivities';
import type { CorrectionBody } from '../../api/hooks/admin/useAdminCorrection';
import {
  useAdminUser,
  useAdminUserActivities,
  type AdminActivity,
  type AdminUser,
} from '../../api/hooks/admin/useAdminUsers';
import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { useSports, type Sport } from '../../api/hooks/useSports';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { isActivityId } from '../../domain/activity';
import { isUserId } from '../../domain/challenge';
import { displayName } from '../../domain/displayName';
import {
  activityFormValues,
  EMPTY_ACTIVITY_INPUT,
  type ActivityCreateValues,
  type RecordedActivity,
} from '../../domain/schemas/activity';
import { ActivityFormFields } from '../activities/ActivityForm';
import { useActivityLine } from './activityLine';
import { RecomputeFlow } from './RecomputeFlow';
import { useAccountTimeZone } from './useAccountTimeZone';

const CARD = 'rounded-card border border-border bg-surface p-4 lg:p-5';
const accountPath = (userId: string) => `/admin/users/${encodeURIComponent(userId)}`;

/** The entry as the API records it, for the preview's line and a way back. */
function recorded(values: ActivityCreateValues): RecordedActivity {
  return {
    sport_code: values.sport_code,
    sport_label: values.sport_label ?? null,
    started_at: values.started_at,
    duration_seconds: values.duration_seconds,
    distance_meters: values.distance_meters ?? null,
    elevation_gain_meters: values.elevation_gain_meters ?? null,
  };
}

/**
 * An admin adds an activity to an account, or changes one of its activities
 * (mockup « Ajouter une activité »): the entry form of the activities, in any
 * week, locked ones and those of a finished challenge included (only the
 * server refuses, with the rules of any entry). Then the preview of every
 * challenge it touches, and the reason. Tests give `now` and the device's
 * time zone.
 */
export function AdminActivityEditor({
  now,
  deviceTimeZone,
}: {
  now?: () => Date;
  deviceTimeZone?: string;
}) {
  const { t } = useTranslation();
  const { userId, activityId } = useParams();
  const valid = isUserId(userId);
  const user = useAdminUser(valid ? userId : '', valid);

  let content: ReactNode;
  if (!valid || (user.error instanceof ApiError && user.error.code === 'user_not_found')) {
    content = <p className={`${CARD} text-muted`}>{t('admin.users.notFound')}</p>;
  } else if (activityId !== undefined && !isActivityId(activityId)) {
    content = (
      <p className={`${CARD} text-muted`}>{t('admin.activityForm.errors.activity_not_found')}</p>
    );
  } else if (user.isPending) {
    content = <LoadingState />;
  } else if (user.isError) {
    content = <ErrorState error={user.error} onRetry={() => void user.refetch()} />;
  } else if (user.data.deleted_at !== null) {
    content = <p className={`${CARD} text-muted`}>{t('admin.activityForm.deleted')}</p>;
  } else {
    content = (
      <Entry
        user={user.data}
        activityId={activityId}
        now={now ?? (() => new Date())}
        deviceTimeZone={deviceTimeZone}
      />
    );
  }
  const name = user.data && displayName(user.data);
  return (
    <div className="mt-6 flex flex-col gap-6">
      <Link
        to={valid ? accountPath(userId) : '/admin/users'}
        className="-ml-2 inline-flex h-11 min-w-0 items-center gap-2 self-start rounded-tab px-2 font-semibold hover-fill"
      >
        <ArrowLeft aria-hidden="true" size={18} className="flex-none" />
        <span className="truncate">{name ?? t('admin.users.back')}</span>
      </Link>
      {content}
    </div>
  );
}

/**
 * What the form needs: the sports, the account's time zone and, to change
 * one, the activity, looked for in the account's list page after page (the
 * API has no route for a single one).
 */
function Entry({
  user,
  activityId,
  now,
  deviceTimeZone,
}: {
  user: AdminUser;
  activityId: string | undefined;
  now: () => Date;
  deviceTimeZone: string | undefined;
}) {
  const { t } = useTranslation();
  const sports = useSports();
  const zone = useAccountTimeZone(user.id, deviceTimeZone);
  const editing = activityId !== undefined;
  const activities = useAdminUserActivities(user.id, 'all', editing);
  const activity = activities.data?.pages
    .flatMap((page) => page.items)
    .find((candidate) => candidate.id === activityId);
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = activities;
  const searching = editing && !activity && hasNextPage && !isError;
  useEffect(() => {
    if (searching && !isFetchingNextPage) void fetchNextPage();
  }, [searching, isFetchingNextPage, fetchNextPage]);

  if (sports.isPending || zone.isPending || (editing && (activities.isPending || searching))) {
    return <LoadingState />;
  }
  if (!sports.data || zone.timeZone === undefined) {
    return (
      <ErrorState
        error={sports.error ?? zone.error}
        onRetry={() => {
          if (sports.isError) void sports.refetch();
          if (zone.isError) zone.refetch();
        }}
      />
    );
  }
  if (editing && !activity) {
    if (!activities.data || isError) {
      return <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />;
    }
    return (
      <p className={`${CARD} text-muted`}>{t('admin.activityForm.errors.activity_not_found')}</p>
    );
  }
  return (
    <Flow user={user} activity={activity} sports={sports.data} timeZone={zone.timeZone} now={now} />
  );
}

function Flow({
  user,
  activity,
  sports,
  timeZone,
  now,
}: {
  user: AdminUser;
  activity: AdminActivity | undefined;
  sports: readonly Sport[];
  timeZone: string;
  now: () => Date;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const navigate = useNavigate();
  const line = useActivityLine();
  const name = displayName(user) ?? t('admin.users.noName');
  const kind = activity ? 'edit' : 'add';
  // The entry sent for the preview: read by `send` at once, shown by the
  // preview, and the form's content when it comes back to the fields.
  const asked = useRef<AdminActivityFields | null>(null);
  const [entry, setEntry] = useState<RecordedActivity | null>(null);
  const [initial] = useState(() =>
    activity ? activityFormValues(activity, timeZone, locale) : EMPTY_ACTIVITY_INPUT,
  );

  const send = (client: ApiClient, body: CorrectionBody) => {
    const fields = asked.current;
    if (!fields) return Promise.resolve(undefined);
    return sendAdminActivityChange(
      client,
      activity
        ? { kind: 'edit', activityId: activity.id, activity: fields }
        : { kind: 'add', userId: user.id, activity: fields },
      body,
    );
  };

  return (
    <RecomputeFlow
      change={{
        title: t(`admin.activityForm.${kind}.title`, { name }),
        details: entry ? line(entry, timeZone) : undefined,
      }}
      reasonTitle={t(`admin.activityForm.${kind}.reasonTitle`)}
      confirmLabel={t(`admin.activityForm.${kind}.confirm`)}
      errorScope="admin.activityForm.errors"
      send={send}
      onDone={() => void navigate(accountPath(user.id))}
    >
      {({ showPreview, pending }) => (
        <div className="flex flex-col gap-6">
          <h2 className="font-display text-2xl font-bold break-words md:text-3xl">
            {t(`admin.activityForm.${kind}.title`, { name })}
          </h2>
          <p role="note" className="flex gap-3 rounded-card bg-ink p-4 text-bg lg:p-5">
            <Shield aria-hidden="true" size={20} className="mt-0.5 flex-none text-accent" />
            <span>
              <Trans
                i18nKey="admin.activityForm.note"
                values={{ name }}
                components={{ b: <strong /> }}
              />
            </span>
          </p>
          <ActivityFormFields
            sports={sports}
            timeZone={timeZone}
            now={now}
            // Back from the preview, the form opens with the entry sent.
            initialValues={entry ? activityFormValues(entry, timeZone, locale) : initial}
            submitKey="admin.activityForm.preview"
            busy={pending}
            errorScope="admin.activityForm.errors"
            cancelTo={accountPath(user.id)}
            save={(values) =>
              new Promise<void>((resolve, reject) => {
                asked.current = values;
                setEntry(recorded(values));
                showPreview({ onShown: resolve, onRefused: reject });
              })
            }
          />
        </div>
      )}
    </RecomputeFlow>
  );
}
