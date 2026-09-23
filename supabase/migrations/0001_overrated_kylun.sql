ALTER TABLE "process_steps" ADD COLUMN "system" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "process_steps" ADD COLUMN "test_data" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "process_steps" ADD COLUMN "responsible" text DEFAULT '' NOT NULL;