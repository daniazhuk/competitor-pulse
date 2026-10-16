import type { FieldChange, Listing } from '@competitor-pulse/contract';

export interface ChangeSummaryInput {
  competitorId: string;
  previous: Listing;
  current: Listing;
  changes: readonly FieldChange[];
}

export interface ChangeSummarizer {
  summarize(input: ChangeSummaryInput): Promise<string>;
}
