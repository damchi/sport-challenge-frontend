import { useState } from 'react';
import { DEFAULT_PAGE_SIZE, isPageSize, type PageSize } from '../domain/pageSize';

/** The lists whose size is kept, each on its own. */
export type SizedList =
  | 'challenges'
  | 'participants'
  | 'activities'
  | 'challengeActivities'
  | 'participantActivities'
  | 'leaderboard';

const key = (list: SizedList) => `sport-challenge:page-size:${list}`;

function readSize(list: SizedList): PageSize {
  try {
    const stored = localStorage.getItem(key(list));
    return isPageSize(stored) ? stored : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

/** The size a list shows (10 by default), kept on the device once chosen. */
export function usePageSize(list: SizedList): [PageSize, (size: PageSize) => void] {
  const [size, setSize] = useState(() => readSize(list));
  const choose = (next: PageSize) => {
    setSize(next);
    try {
      localStorage.setItem(key(list), next);
    } catch {
      // Storage unavailable: the choice lasts until the page closes.
    }
  };
  return [size, choose];
}
