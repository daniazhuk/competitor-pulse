import { competitorSchema, type Competitor } from '@competitor-pulse/contract';
import { z } from 'zod';
import { jsonBody, requestJson, requestNoContent } from '../../shared/api-client';

export const fetchCompetitors = (): Promise<Competitor[]> =>
  requestJson('/api/competitors', z.array(competitorSchema));

export const trackCompetitor = (id: string): Promise<Competitor> =>
  requestJson('/api/competitors', competitorSchema, { method: 'POST', ...jsonBody({ id }) });

export const untrackCompetitor = (id: string): Promise<void> =>
  requestNoContent(`/api/competitors/${encodeURIComponent(id)}`, { method: 'DELETE' });
