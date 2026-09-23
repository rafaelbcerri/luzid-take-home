UPDATE "process_steps"
SET "description" = CASE
  WHEN BTRIM("description") = '' THEN 'Test data: ' || BTRIM("test_data")
  ELSE BTRIM("description") || E'\n\nTest data: ' || BTRIM("test_data")
END
WHERE BTRIM("test_data") <> ''
  AND POSITION(LOWER(BTRIM("test_data")) IN LOWER("description")) = 0;
--> statement-breakpoint
ALTER TABLE "process_steps" DROP COLUMN "test_data";
