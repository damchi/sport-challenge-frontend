import type { ComponentProps } from 'react';

/**
 * An on/off checkbox drawn as a switch (role="switch", so read as on or off).
 * The caller names it (aria-labelledby or a wrapping label) and makes the
 * whole row clickable: the switch alone is smaller than 44 px.
 */
export function Switch(props: Omit<ComponentProps<'input'>, 'type' | 'role' | 'className'>) {
  return (
    <span className="relative inline-flex flex-none">
      <input
        type="checkbox"
        role="switch"
        // Over the drawn switch, invisible: clicked and focused there.
        className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
        {...props}
      />
      <span
        aria-hidden="true"
        className="h-8 w-13 rounded-full bg-muted transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        className="absolute top-1 left-1 size-6 rounded-full bg-surface shadow-sm transition-transform peer-checked:translate-x-5 motion-reduce:transition-none"
      />
    </span>
  );
}
