import type { LucideIcon } from 'lucide-react';

// Tones of the statuses shown so far; each new status adds its own.
const TONES = {
  neutral: 'bg-segment text-muted',
  ok: 'bg-ok-bg text-ok-fg',
  out: 'bg-out-bg text-out-fg',
  risk: 'bg-risk-bg text-risk-fg',
} as const;

interface StatusPillProps {
  label: string;
  Icon: LucideIcon;
  tone: keyof typeof TONES;
}

/** Status pill: an icon and a label, never the colour alone (design.md). */
export function StatusPill({ label, Icon, tone }: StatusPillProps) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${TONES[tone]}`}
    >
      <Icon aria-hidden="true" size={14} strokeWidth={2} className="shrink-0" />
      {label}
    </span>
  );
}
