import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';
import { Avatar } from '../../components/Avatar';
import { displayName } from '../../domain/displayName';
import { formatKm } from '../../domain/format/distance';
import { formatDuration } from '../../domain/format/duration';
import { useSportName } from '../challenges/create/useSportName';
import { EliminationProgress } from './EliminationProgress';
import { ProvisionalPoints } from './ProvisionalPoints';

type CategoryType = Leaderboard['categories'][number]['type'];

interface EntryProps {
  entry: LeaderboardEntry;
  type: CategoryType;
  /** The signed-in user's entry: highlighted, named "Toi". */
  me: boolean;
  /** Address of the participant's activities, for those who may open them. */
  href: string | undefined;
}

interface RankedProps extends EntryProps {
  /** Another participant holds the same rank. */
  tied: boolean;
  /** The sport the cumulative distance is brought back to. */
  referenceSport: string;
}

const BOX = 'rounded-row border';
const BOX_ON = 'border-2 border-accent bg-accent-soft';
const BOX_OFF = 'border-border bg-surface';
const BOX_RISK = 'border-2 border-risk-border bg-surface';

/** The entry as a link to the participant's activities, or as plain text. */
function EntryBox({
  href,
  className,
  children,
}: {
  href: string | undefined;
  className: string;
  children: ReactNode;
}) {
  return href ? (
    <Link to={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** Name shown: "Toi" for the user, else the participant's, else a neutral one. */
function useEntryName(entry: LeaderboardEntry, me: boolean): string {
  const { t } = useTranslation();
  if (me) return t('leaderboard.you');
  return displayName(entry.user) ?? t('challengeDetail.participants.unnamed');
}

/**
 * The value of a category: h:mm, km equivalent to the reference sport, km
 * done in the reference sport (elimination), or points acquired.
 */
function useEntryValue(type: CategoryType, value: number | null, referenceSport: string): string {
  const { t, i18n } = useTranslation();
  const sportName = useSportName();
  if (value === null) return '';
  if (type === 'cumulative_time') return formatDuration(value);
  if (type === 'points') return t('leaderboard.points', { count: value });
  const locale = i18n.resolvedLanguage ?? 'fr';
  const distance = formatKm(value / 1000, locale);
  if (type !== 'cumulative_distance') return distance;
  // Inside a sentence: "12,5 km éq. vélo".
  const sport = sportName(referenceSport).toLocaleLowerCase(locale);
  return t('leaderboard.equivalent', { distance, sport });
}

/** A card of the podium: the rank as an ordinal ("1er"), noted when shared. */
export function PodiumCard({ entry, type, me, href, tied, referenceSport }: RankedProps) {
  const { t } = useTranslation();
  const name = useEntryName(entry, me);
  const value = useEntryValue(type, entry.value, referenceSport);
  return (
    <EntryBox
      href={href}
      className={`flex w-full flex-col items-center gap-1 p-3 text-center ${BOX} ${me ? BOX_ON : BOX_OFF}`}
    >
      <span className="font-display text-lg font-bold">
        {t('leaderboard.rank', { count: entry.rank ?? 0, ordinal: true })}
        {tied && (
          <span className="block text-xs font-semibold text-muted">{t('leaderboard.tied')}</span>
        )}
      </span>
      <Avatar userId={entry.user.id} user={entry.user} />
      <span className="w-full truncate font-semibold" title={name}>
        {name}
      </span>
      <span className="text-sm font-bold tabular-nums">
        {value}
        <ProvisionalPoints points={entry.provisional_points} />
      </span>
    </EntryBox>
  );
}

/**
 * A row of the full ranking: the rank written as text (1, 1, 3), as the
 * server gives it, and in the elimination the week of the participant.
 */
export function LeaderboardRow({ entry, type, me, href, tied, referenceSport }: RankedProps) {
  const { t } = useTranslation();
  const name = useEntryName(entry, me);
  const value = useEntryValue(type, entry.value, referenceSport);
  const atRisk = entry.elimination?.status === 'at_risk';
  return (
    <EntryBox
      href={href}
      className={`flex min-h-14 items-center gap-3 px-3 py-2 ${BOX} ${me ? BOX_ON : atRisk ? BOX_RISK : BOX_OFF}`}
    >
      <span className="min-w-[22px] shrink-0 text-center font-bold text-muted tabular-nums">
        {entry.rank}
        {tied && <span className="sr-only"> {t('leaderboard.tied')}</span>}
      </span>
      <Avatar userId={entry.user.id} user={entry.user} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold" title={name}>
          {name}
        </span>
        {entry.elimination && <EliminationProgress progress={entry.elimination} />}
      </span>
      <span className="shrink-0 text-right font-bold tabular-nums">
        {value}
        <ProvisionalPoints points={entry.provisional_points} />
      </span>
    </EntryBox>
  );
}

/**
 * A participant out of the ranking, who abandoned or was eliminated from the
 * elimination: dashed and muted, without a rank nor a value (design.md).
 */
export function OutRow({ entry, me, href }: EntryProps) {
  const { t } = useTranslation();
  const name = useEntryName(entry, me);
  const week = entry.elimination?.eliminated_week;
  return (
    <EntryBox
      href={href}
      className={`flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-row border border-dashed border-border-dashed px-3 py-2 text-muted`}
    >
      <Avatar userId={entry.user.id} user={entry.user} muted />
      <span className="min-w-0 flex-1 truncate font-semibold" title={name}>
        {name}
      </span>
      <span className="ml-auto text-right text-sm">
        {entry.abandoned || !week
          ? t('leaderboard.abandoned')
          : t('leaderboard.eliminated', { week })}
      </span>
    </EntryBox>
  );
}
