CREATE TABLE "actor" (
	"did" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"description" text,
	"avatar" text,
	"banner" text,
	"interested_at" timestamp with time zone,
	"backfilled_at" timestamp with time zone,
	"backfill_attempted_at" timestamp with time zone,
	"backfill_error" text,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_cursor" (
	"source" text PRIMARY KEY NOT NULL,
	"cursor" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"uri" text PRIMARY KEY NOT NULL,
	"cid" text NOT NULL,
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"text" text,
	"media" jsonb NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"repost_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_like" (
	"uri" text PRIMARY KEY NOT NULL,
	"subject_uri" text NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "actor_handle_idx" ON "actor" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "actor_backfill_queue_idx" ON "actor" USING btree ("interested_at","backfill_attempted_at");--> statement-breakpoint
CREATE INDEX "post_author_feed_idx" ON "post" USING btree ("did","created_at" desc,"uri" desc);--> statement-breakpoint
CREATE INDEX "post_like_subject_idx" ON "post_like" USING btree ("subject_uri");