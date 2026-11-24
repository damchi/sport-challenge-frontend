import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/errors';
import {
  useAdminChallenge,
  type AdminChallengeDetail,
} from '../../api/hooks/admin/useAdminChallenges';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { isChallengeId } from '../../domain/challenge';
import { displayName } from '../../domain/displayName';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { dateTime } from '../../domain/format/instant';
import { ChallengeDetails } from '../challenges/detail/ChallengeDetails';
import { CategoryParams } from '../challenges/detail/CategoryParams';
import { useCategoryName } from '../challenges/detail/categoryNames';
import {
  AdminChallengeActions,
  AdminChallengeEliminations,
  AdminChallengeInvitations,
  AdminChallengeWeeks,
} from './AdminChallengeTables';
import { SheetPart } from './SheetPart';

const LIST = '/admin/challenges';
const CARD = 'rounded-card border border-border bg-surface p-4 lg:p-5';
const H2 = 'font-display text-xl font-bold';

function BackToList() {
  const { t } = useTranslation();
  return (
    <Link
      to={LIST}
      className="-ml-2 inline-flex h-11 items-center gap-2 rounded-tab px-2 font-semibold hover-fill"
    >
      <ArrowLeft aria-hidden="true" size={18} />
      {t('admin.challenges.back')}
    </Link>
  );
}

/**
 * The admin's sheet of a challenge, deleted or not: who made it and when,
 * its settings, its weeks and how each was judged, its eliminations, its
 * frozen results, its invitation links and the last admin changes. The
 * instants are the challenge's, in its time zone (named when it is not the
 * device's). A challenge not deleted links to its usual page, which the admin
 * may read.
 */
export function AdminChallengeSheet() {
  const { t } = useTranslation();
  const { challengeId } = useParams();
  const valid = isChallengeId(challengeId);
  // An address that cannot be a challenge asks nothing of the server.
  const challenge = useAdminChallenge(valid ? challengeId : '', valid);

  let content: ReactNode;
  if (
    !valid ||
    (challenge.error instanceof ApiError && challenge.error.code === 'challenge_not_found')
  ) {
    content = <p className={`${CARD} text-muted`}>{t('admin.challenges.notFound')}</p>;
  } else if (challenge.isPending) {
    content = <LoadingState />;
  } else if (challenge.isError) {
    content = <ErrorState error={challenge.error} onRetry={() => void challenge.refetch()} />;
  } else {
    content = <Sheet challenge={challenge.data} />;
  }
  return (
    <div className="mt-6 flex flex-col gap-6">
      <BackToList />
      {content}
    </div>
  );
}

function Sheet({ challenge }: { challenge: AdminChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const zone = challenge.timezone;
  const at = (instant: string) => dateTime(instant, zone, locale);
  const otherZone = otherTimeZoneName(
    zone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );
  const categoryName = useCategoryName(challenge.reference_sport);
  const ordered = [...challenge.categories].sort((a, b) => a.position - b.position);
  const creators = challenge.creators
    .map((user) => displayName(user) ?? t('admin.challenges.unnamed'))
    .join(', ');
  const facts = [
    [t('admin.challenges.sheet.status'), t(`admin.challenges.status.${challenge.status}`)],
    [t('admin.challenges.sheet.creators'), creators],
    [
      t('admin.challenges.sheet.participants'),
      new Intl.NumberFormat(locale).format(challenge.participant_count),
    ],
    [t('admin.challenges.sheet.createdAt'), at(challenge.created_at)],
    [
      t('admin.challenges.sheet.results'),
      challenge.results_frozen_at
        ? t('admin.challenges.sheet.frozenAt', { date: at(challenge.results_frozen_at) })
        : t('admin.challenges.sheet.notFrozen'),
    ],
  ];

  return (
    <article aria-labelledby="admin-challenge-title" className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h2 id="admin-challenge-title" className={`${H2} break-words`}>
          {challenge.title}
        </h2>
        {challenge.deleted_at !== null ? (
          // Its usual page is closed to everyone, the admin too.
          <p role="note" className="rounded-row bg-segment px-4 py-3 font-semibold">
            {t('admin.challenges.sheet.deletedAt', { date: at(challenge.deleted_at) })}
          </p>
        ) : (
          <Link
            to={`/challenges/${challenge.id}`}
            className="inline-flex h-11 items-center gap-2 self-start font-bold text-accent underline underline-offset-4 hover-link"
          >
            {t('admin.challenges.sheet.open')}
            <ExternalLink aria-hidden="true" size={16} />
          </Link>
        )}
        {challenge.description && (
          <p className="whitespace-pre-line break-words text-muted">{challenge.description}</p>
        )}
        {otherZone && (
          <p className="text-sm text-muted">
            {t('admin.challenges.sheet.zone', { zone: otherZone })}
          </p>
        )}
      </header>

      <dl className={CARD}>
        {facts.map(([term, value]) => (
          <div
            key={term}
            className="flex flex-wrap justify-between gap-x-4 border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0"
          >
            <dt className="text-muted">{term}</dt>
            <dd className="ml-auto text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <SheetPart title={t('admin.challenges.sheet.settings')}>
        {/* No week_count in the admin's challenge: the server lists its weeks. */}
        <ChallengeDetails challenge={{ ...challenge, week_count: challenge.weeks.length }} />
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ordered.map((category) => (
            <li key={category.type} className={CARD}>
              <p className="font-bold">{categoryName(category.type)}</p>
              <div className="mt-1">
                <CategoryParams category={category} />
              </div>
            </li>
          ))}
        </ul>
      </SheetPart>

      <AdminChallengeWeeks weeks={challenge.weeks} at={at} zone={zone} locale={locale} />
      {challenge.categories.some((category) => category.type === 'elimination') && (
        <AdminChallengeEliminations eliminations={challenge.eliminations} locale={locale} />
      )}
      <AdminChallengeInvitations invitations={challenge.invitations} at={at} />
      <AdminChallengeActions actions={challenge.recent_actions} at={at} />
    </article>
  );
}
