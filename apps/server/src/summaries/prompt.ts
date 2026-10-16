import type { Listing } from '@competitor-pulse/contract';
import { describeChanges } from '../snapshots/diff.js';
import type { ChangeSummaryInput } from './change-summarizer.js';

export const SYSTEM_PROMPT = [
  'You summarize changes to a competitor product listing for a product marketing team.',
  'Write one or two short plain-English sentences describing only what changed.',
  'Mention concrete before/after values for prices. Do not speculate about reasons.',
  'Respond with the summary text only, no preamble or formatting.',
].join(' ');

const formatListing = (listing: Listing): string =>
  [
    `Title: ${listing.title}`,
    `Tagline: ${listing.tagline}`,
    `Price: ${listing.price}`,
    `Description: ${listing.description}`,
  ].join('\n');

/** The diff goes first: it is the ground truth, the full listings are context. */
export function buildUserPrompt({
  competitorId,
  previous,
  current,
  changes,
}: ChangeSummaryInput): string {
  return [
    `Competitor: ${competitorId}`,
    `Changed fields:\n${describeChanges(changes)}`,
    `Previous listing:\n${formatListing(previous)}`,
    `New listing:\n${formatListing(current)}`,
  ].join('\n\n');
}
