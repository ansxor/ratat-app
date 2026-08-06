CREATE TABLE "ratat_follow" (
	"uri" text PRIMARY KEY NOT NULL,
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"subject" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actor" ADD COLUMN "follows_wanted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "actor" ADD COLUMN "follows_backfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "actor" ADD COLUMN "follows_backfill_attempted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ratat_follow_did_idx" ON "ratat_follow" USING btree ("did","subject");--> statement-breakpoint
CREATE INDEX "ratat_follow_subject_idx" ON "ratat_follow" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "actor_follows_queue_idx" ON "actor" USING btree ("follows_wanted_at","follows_backfill_attempted_at");--> statement-breakpoint
CREATE INDEX "post_timeline_idx" ON "post" USING btree ("created_at" desc,"uri" desc);