CREATE TYPE "public"."recording_status" AS ENUM('uploading', 'analyzing', 'capturing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "process_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"action" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"expected_result" text DEFAULT '' NOT NULL,
	"timestamp_seconds" real DEFAULT 0 NOT NULL,
	"screenshot_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"status" "recording_status" DEFAULT 'uploading' NOT NULL,
	"error_message" text,
	"original_file_name" text NOT NULL,
	"video_path" text NOT NULL,
	"duration_seconds" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "process_steps_recording_position_idx" ON "process_steps" USING btree ("recording_id","position");