import { z } from 'zod';

const COMPETITOR_ID_MAX_LENGTH = 64;
const COMPETITOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export const competitorSchema = z.object({ id: z.string() });
export type Competitor = z.infer<typeof competitorSchema>;

export const LISTING_FIELDS = ['title', 'tagline', 'price', 'description'] as const;
const listingFieldSchema = z.enum(LISTING_FIELDS);

export const listingSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  price: z.string(),
  description: z.string(),
});
export type Listing = z.infer<typeof listingSchema>;

const fieldChangeSchema = z.object({
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
const summaryStatusSchema = z.enum(SUMMARY_STATUSES);

export const snapshotSchema = listingSchema.extend({
  id: z.string(),
  fetchedAt: z.iso.datetime(),
  changed: z.boolean(),
  summary: z.string().nullable(),
  summaryStatus: summaryStatusSchema,
  changes: z.array(fieldChangeSchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

const SNAPSHOTS_DEFAULT_LIMIT = 100;
const SNAPSHOTS_MAX_LIMIT = 500;

export const snapshotsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(SNAPSHOTS_MAX_LIMIT).default(SNAPSHOTS_DEFAULT_LIMIT),
  before: z.iso.datetime().optional(),
});

export type ErrorCode =
  'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'UNKNOWN_COMPETITOR' | 'INTERNAL_ERROR';

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
