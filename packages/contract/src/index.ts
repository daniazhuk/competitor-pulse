import { z } from 'zod';

export const COMPETITOR_ID_MAX_LENGTH = 64;
export const COMPETITOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Accepts user input like " Acme-CRM " and normalizes it to a canonical slug. */
export const competitorIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Competitor id is required')
  .max(
    COMPETITOR_ID_MAX_LENGTH,
    `Competitor id must be at most ${COMPETITOR_ID_MAX_LENGTH} characters`,
  )
  .regex(COMPETITOR_ID_PATTERN, 'Use lowercase letters, digits and single dashes, e.g. acme-crm');

export const createCompetitorBodySchema = z.object({ id: competitorIdSchema });
export type CreateCompetitorBody = z.input<typeof createCompetitorBodySchema>;

export const competitorSchema = z.object({ id: z.string() });
export type Competitor = z.infer<typeof competitorSchema>;

export const LISTING_FIELDS = ['title', 'tagline', 'price', 'description'] as const;
export const listingFieldSchema = z.enum(LISTING_FIELDS);
export type ListingField = z.infer<typeof listingFieldSchema>;

export const listingSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  price: z.string(),
  description: z.string(),
});
export type Listing = z.infer<typeof listingSchema>;

export const fieldChangeSchema = z.object({
  field: listingFieldSchema,
  before: z.string(),
  after: z.string(),
});
export type FieldChange = z.infer<typeof fieldChangeSchema>;

/**
 * `none`: no change, nothing to summarize. `pending`: queued for the LLM.
 * `ready`: summary available. `failed`: gave up after retries.
 */
export const SUMMARY_STATUSES = ['none', 'pending', 'ready', 'failed'] as const;
export const summaryStatusSchema = z.enum(SUMMARY_STATUSES);
export type SummaryStatus = z.infer<typeof summaryStatusSchema>;

export const snapshotSchema = listingSchema.extend({
  id: z.string(),
  fetchedAt: z.iso.datetime(),
  changed: z.boolean(),
  summary: z.string().nullable(),
  summaryStatus: summaryStatusSchema,
  changes: z.array(fieldChangeSchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const SNAPSHOTS_DEFAULT_LIMIT = 100;
export const SNAPSHOTS_MAX_LIMIT = 500;

export const snapshotsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(SNAPSHOTS_MAX_LIMIT).default(SNAPSHOTS_DEFAULT_LIMIT),
  before: z.iso.datetime().optional(),
});
export type SnapshotsQuery = z.input<typeof snapshotsQuerySchema>;

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'UNKNOWN_COMPETITOR',
  'INTERNAL_ERROR',
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
