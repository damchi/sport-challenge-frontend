import { avatarColor, initials } from '../domain/avatar';

// Tailwind needs the full class names in the source.
const COLORS: Record<number, string> = {
  1: 'bg-avatar-1-bg text-avatar-1-fg',
  2: 'bg-avatar-2-bg text-avatar-2-fg',
  3: 'bg-avatar-3-bg text-avatar-3-fg',
  4: 'bg-avatar-4-bg text-avatar-4-fg',
  5: 'bg-avatar-5-bg text-avatar-5-fg',
  6: 'bg-avatar-6-bg text-avatar-6-fg',
};

interface AvatarProps {
  userId: string;
  /** The name shown next to it (see displayName). */
  name: string;
}

/** Round initials avatar. Decorative: the name is always written next to it. */
export function Avatar({ userId, name }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${COLORS[avatarColor(userId)]}`}
    >
      {initials(name)}
    </span>
  );
}
