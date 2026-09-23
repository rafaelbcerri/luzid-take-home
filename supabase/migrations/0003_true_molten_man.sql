ALTER TABLE "recordings" ADD COLUMN "owner_user_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX "recordings_owner_created_idx" ON "recordings" USING btree ("owner_user_id","created_at");--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_owner_user_id_auth_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");--> statement-breakpoint
REVOKE ALL ON TABLE "recordings", "process_steps" FROM PUBLIC, anon, authenticated;
