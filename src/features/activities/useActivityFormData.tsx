import { useSports } from '../../api/hooks/useSports';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { useActivityTimeZone } from './useActivityTimeZone';

/**
 * What an activity form needs before it shows: the catalogue of sports and
 * the time zone its start is read in. `view` is what to show meanwhile:
 * loading, or the error with a retry.
 */
export function useActivityFormData(deviceTimeZone: string | undefined, paused = false) {
  const sports = useSports();
  const zone = useActivityTimeZone(deviceTimeZone, paused);
  if (sports.isPending || zone.isPending) {
    return { state: 'pending', view: <LoadingState /> } as const;
  }
  if (!sports.data || zone.timeZone === undefined) {
    return {
      state: 'error',
      view: (
        <ErrorState
          error={sports.error ?? zone.error}
          onRetry={() => {
            if (sports.isError) void sports.refetch();
            if (zone.isError) zone.refetch();
          }}
        />
      ),
    } as const;
  }
  return { state: 'ready', sports: sports.data, timeZone: zone.timeZone } as const;
}
