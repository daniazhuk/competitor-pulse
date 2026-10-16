import { LISTING_FIELDS, type FieldChange, type Listing } from '@competitor-pulse/contract';

/**
 * Deterministic field-level diff. The first snapshot of a competitor has nothing
 * to compare against, so it is reported as "no change" rather than "everything changed".
 */
export function diffListings(previous: Listing | undefined, current: Listing): FieldChange[] {
  if (!previous) return [];

  return LISTING_FIELDS.filter((field) => previous[field] !== current[field]).map((field) => ({
    field,
    before: previous[field],
    after: current[field],
  }));
}

/** Plain-text rendering of a diff, used in the LLM prompt and as a UI fallback. */
export function describeChanges(changes: readonly FieldChange[]): string {
  return changes
    .map(({ field, before, after }) => `${field}: "${before}" -> "${after}"`)
    .join('\n');
}
