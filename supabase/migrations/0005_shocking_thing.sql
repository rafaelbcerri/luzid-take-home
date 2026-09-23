CREATE TABLE "recording_public_shares" (
	"recording_id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recording_public_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "owner_user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "recording_public_shares" ADD CONSTRAINT "recording_public_shares_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_owner_user_id_auth_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");--> statement-breakpoint
CREATE INDEX "recordings_owner_created_idx" ON "recordings" USING btree ("owner_user_id","created_at");
--> statement-breakpoint
REVOKE ALL ON TABLE "recordings", "process_steps", "recording_public_shares" FROM PUBLIC, anon, authenticated;
