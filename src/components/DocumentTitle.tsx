import { useEffect } from 'react';

/**
 * Sets the browser tab's title, and puts the previous one back when it goes.
 * Effects run in tree order, so a page that renders one inside the layout's
 * outlet overrides the layout's own, which comes before the outlet; when the
 * page goes while the layout's title stays, the layout's comes back.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
  return null;
}
