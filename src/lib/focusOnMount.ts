/**
 * Ref callback that gives the focus to an element once it is mounted. Stable
 * (defined once): React calls it for each new element, not on each render.
 * Pair it with a `key` that changes when a new message must take the focus.
 */
export function focusOnMount(element: HTMLElement | null) {
  element?.focus();
}
