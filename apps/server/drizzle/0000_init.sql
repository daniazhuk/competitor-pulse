CREATE TYPE "public"."summary_status" AS ENUM('none', 'pending', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitors_id_slug" CHECK ("competitors"."id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" text NOT NULL,
	"previous_snapshot_id" uuid,
	"fetched_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"tagline" text NOT NULL,
	"price" text NOT NULL,
	"description" text NOT NULL,
	"changed" boolean NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"summary_status" "summary_status" NOT NULL,
	"summary_attempts" integer DEFAULT 0 NOT NULL,
	"summary_next_attempt_at" timestamp with time zone,
	"summary_error" text
);
--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_previous_snapshot_id_snapshots_id_fk" FOREIGN KEY ("previous_snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_competitor_fetched_at_idx" ON "snapshots" USING btree ("competitor_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "snapshots_pending_summary_idx" ON "snapshots" USING btree ("summary_next_attempt_at") WHERE "snapshots"."summary_status" = 'pending';