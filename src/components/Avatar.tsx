import { avatarColor, avatarInitials } from '../domain/avatar';
import type { NamedUser } from '../domain/displayName';

// Tailwind needs the full class names in the source.
const COLORS: Record<number, string> = {
  1: 'bg-avatar-1-bg text-avatar-1-fg',
  2: 'bg-avatar-2-bg text-avatar-2-fg',
  3: 'bg-avatar-3-bg text-avatar-3-fg',
  4: 'bg-avatar-4-bg text-avatar-4-fg',
  5: 'bg-avatar-5-bg text-avatar-5-fg',
  6: 'bg-avatar-6-bg text-avatar-6-fg',
};

// 32 px in rows (design.md); larger at the head of the profile.
const SIZES = {
  md: 'size-8 text-xs',
  lg: 'size-18 text-2xl',
};

interface AvatarProps {
  userId: string;
  user: NamedUser;
  size?: keyof typeof SIZES;
  /** Grey, for a participant out of the challenge (design.md). */
  muted?: boolean;
}

/** Round initials avatar. Decorative: the name is always written next to it. */
export function Avatar({ userId, user, size = 'md', muted = false }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${SIZES[size]} ${muted ? 'bg-segment text-muted' : COLORS[avatarColor(userId)]}`}
    >
      {avatarInitials(user) || '?'}
    </span>
  );
}
