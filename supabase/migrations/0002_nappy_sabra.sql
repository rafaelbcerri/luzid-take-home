ALTER TABLE "process_steps" ADD COLUMN "evidence_timestamp_seconds" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "process_steps" SET "evidence_timestamp_seconds" = "timestamp_seconds";
