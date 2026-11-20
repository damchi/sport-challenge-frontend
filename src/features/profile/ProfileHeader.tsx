import type { Me } from '../../api/hooks/useMe';
import { Avatar } from '../../components/Avatar';
import { displayName } from '../../domain/displayName';

/** Head of the profile: the initials avatar and the name others see. */
export function ProfileHeader({ me }: { me: Me }) {
  const name = displayName(me);
  return (
    <div className="mt-6 flex items-center gap-4">
      <Avatar userId={me.id} user={me} size="lg" />
      {name && <p className="min-w-0 font-display text-lg font-bold break-words">{name}</p>}
    </div>
  );
}
