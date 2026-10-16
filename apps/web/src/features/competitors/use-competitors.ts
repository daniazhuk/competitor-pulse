import type { Competitor } from '@competitor-pulse/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCompetitors, trackCompetitor, untrackCompetitor } from './competitors-api';

export const competitorsQueryKey = ['competitors'] as const;

export function useCompetitors() {
  return useQuery({ queryKey: competitorsQueryKey, queryFn: fetchCompetitors });
}

/**
 * Shared optimistic-update plumbing: apply `update` to the cached list right
 * away, roll back if the request fails, and resync with the server either way.
 */
function useOptimisticCompetitorsMutation(
  mutationFn: (id: string) => Promise<unknown>,
  update: (competitors: Competitor[], id: string) => Competitor[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: competitorsQueryKey });
      const previous = queryClient.getQueryData<Competitor[]>(competitorsQueryKey);
      queryClient.setQueryData<Competitor[]>(competitorsQueryKey, (current = []) =>
        update(current, id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(competitorsQueryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: competitorsQueryKey }),
  });
}

export const useTrackCompetitor = () =>
  useOptimisticCompetitorsMutation(trackCompetitor, (competitors, id) =>
    competitors.some((competitor) => competitor.id === id) ? competitors : [...competitors, { id }],
  );

export const useUntrackCompetitor = () =>
  useOptimisticCompetitorsMutation(untrackCompetitor, (competitors, id) =>
    competitors.filter((competitor) => competitor.id !== id),
  );
