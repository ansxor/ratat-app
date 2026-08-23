ALTER TABLE "post_like" ADD COLUMN "did" text;--> statement-breakpoint
UPDATE "post_like" SET "did" = split_part("uri", '/', 3);--> statement-breakpoint
ALTER TABLE "post_like" ALTER COLUMN "did" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "post_like_subject_viewer_idx" ON "post_like" USING btree ("subject_uri","did");
