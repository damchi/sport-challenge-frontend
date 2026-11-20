import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';
import { Avatar } from '../../components/Avatar';
import { displayName } from '../../domain/displayName';
import { formatKm } from '../../domain/format/distance';
import { formatDuration } from '../../domain/format/duration';

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
}

const BOX = 'rounded-row border';
const BOX_ON = 'border-2 border-accent bg-accent-soft';
const BOX_OFF = 'border-border bg-surface';

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

/** The value of a category: h:mm, run-equivalent km, or km run. */
function useEntryValue(type: CategoryType, value: number | null): string {
  const { t, i18n } = useTranslation();
  if (value === null) return '';
  if (type === 'cumulative_time') return formatDuration(value);
  const distance = formatKm(value / 1000, i18n.resolvedLanguage ?? 'fr');
  return type === 'cumulative_distance' ? t('leaderboard.equivalent', { distance }) : distance;
}

/** A card of the podium: the rank as an ordinal ("1er"), noted when shared. */
export function PodiumCard({ entry, type, me, href, tied }: RankedProps) {
  const { t } = useTranslation();
  const name = useEntryName(entry, me);
  const value = useEntryValue(type, entry.value);
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
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </EntryBox>
  );
}

/** A row of the full ranking: the rank written as text (1, 1, 3), as the server gives it. */
export function LeaderboardRow({ entry, type, me, href, tied }: RankedProps) {
  const { t } = useTranslation();
  const name = useEntryName(entry, me);
  const value = useEntryValue(type, entry.value);
  return (
    <EntryBox
      href={href}
      className={`flex min-h-14 items-center gap-3 px-3 py-2 ${BOX} ${me ? BOX_ON : BOX_OFF}`}
    >
      <span className="min-w-[22px] shrink-0 text-center font-bold text-muted tabular-nums">
        {entry.rank}
        {tied && <span className="sr-only"> {t('leaderboard.tied')}</span>}
      </span>
      <Avatar userId={entry.user.id} user={entry.user} />
      <span className="min-w-0 flex-1 truncate font-semibold" title={name}>
        {name}
      </span>
      <span className="shrink-0 font-bold tabular-nums">{value}</span>
    </EntryBox>
  );
}

/** A participant who abandoned: dashed and muted, without a rank nor a value (design.md). */
export function AbandonedRow({ entry, me, href }: EntryProps) {
  const { t } = useTranslation();
  const name = useEntryName(entry, me);
  return (
    <EntryBox
      href={href}
      className={`flex min-h-14 items-center gap-3 rounded-row border border-dashed border-border-dashed px-3 py-2 text-muted`}
    >
      <Avatar userId={entry.user.id} user={entry.user} muted />
      <span className="min-w-0 flex-1 truncate font-semibold" title={name}>
        {name}
      </span>
      <span className="shrink-0 text-sm">{t('leaderboard.abandoned')}</span>
    </EntryBox>
  );
}
