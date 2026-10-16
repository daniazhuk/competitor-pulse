import { snapshotSchema, type Snapshot } from '@competitor-pulse/contract';
import { useInfiniteQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiError, requestJson } from '../../shared/api-client';

export const SNAPSHOTS_PAGE_SIZE = 20;
// New snapshots and pending AI summaries arrive in the background, so keep the view fresh.
const REFRESH_INTERVAL_MS = 5_000;

const fetchSnapshotsPage = (competitorId: string, before: string | undefined) => {
  const params = new URLSearchParams({ limit: String(SNAPSHOTS_PAGE_SIZE) });
  if (before) params.set('before', before);
  return requestJson(
    `/api/competitors/${encodeURIComponent(competitorId)}/snapshots?${params.toString()}`,
    z.array(snapshotSchema),
  );
};

export function useSnapshots(competitorId: string) {
  return useInfiniteQuery({
    queryKey: ['competitors', competitorId, 'snapshots'],
    queryFn: ({ pageParam }) => fetchSnapshotsPage(competitorId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Snapshot[]) =>
      lastPage.length === SNAPSHOTS_PAGE_SIZE ? lastPage.at(-1)?.fetchedAt : undefined,
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 404
        ? false
        : REFRESH_INTERVAL_MS,
    select: (data) => data.pages.flat(),
  });
}
