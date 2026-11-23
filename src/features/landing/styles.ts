// Classes shared by the sections of the landing page (design.md).

/** The page's width: 20 px margins on a phone, 1120 px at most from `lg`. */
export const LANDING_CONTAINER = 'mx-auto w-full max-w-wide px-5 lg:px-8';

export const PRIMARY_BUTTON =
  'inline-flex h-13 items-center justify-center gap-2 rounded-full bg-accent hover-accent px-6 text-button font-bold text-on-accent disabled:opacity-60';

export const SECONDARY_BUTTON =
  'inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface hover-fill px-4 text-sm font-bold disabled:opacity-60';

/** Small accent label above a section title. */
export const EYEBROW = 'text-xs font-bold tracking-[0.6px] text-accent uppercase';

/** Section title (h2). */
export const SECTION_TITLE = 'mt-2 font-display text-2xl font-bold tracking-title lg:text-3xl';

/** A section: its own band of the page. */
export const SECTION = 'border-t border-border py-12 lg:py-16';
