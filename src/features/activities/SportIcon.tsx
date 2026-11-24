import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  Mountain,
  MountainSnow,
  PersonStanding,
  Sailboat,
  Snowflake,
  Timer,
  Waves,
  Weight,
  Wind,
  type LucideIcon,
} from 'lucide-react';

// A line icon per sport of the catalogue (design.md: Lucide, no emoji);
// any other sport, "other" included, has the activities icon.
const ICONS: Partial<Record<string, LucideIcon>> = {
  run: Footprints,
  walk: Footprints,
  hike: Mountain,
  ride: Bike,
  swim: Waves,
  rowing: Sailboat,
  xc_ski: Snowflake,
  yoga: PersonStanding,
  climbing: MountainSnow,
  strength: Dumbbell,
  crossfit: Weight,
  hyrox: Timer,
  paragliding: Wind,
};

/** The sport's icon in an accent tile, decorative: the sport is written beside it. */
export function SportIcon({ code }: { code: string }) {
  const Icon = ICONS[code] ?? Activity;
  return (
    <span
      aria-hidden="true"
      className="flex size-11 flex-none items-center justify-center rounded-row bg-accent-soft text-accent"
    >
      <Icon size={22} strokeWidth={2} />
    </span>
  );
}
