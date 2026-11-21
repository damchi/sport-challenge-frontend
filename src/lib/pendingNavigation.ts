import { useNavigation } from 'react-router';

/**
 * The path a navigation goes to while it waits for the code of its page
 * (pages are loaded on demand; without loaders, nothing else makes it wait).
 */
export function usePendingPath(): string | undefined {
  const navigation = useNavigation();
  return navigation.state === 'loading' ? navigation.location.pathname : undefined;
}

/** Whether the path is `base` or one of the addresses below it. */
export function isWithin(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}
