import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { RECORDING_STATUSES } from "@/lib/types/process-step";

export const recordingStatusEnum = pgEnum(
  "recording_status",
  RECORDING_STATUSES,
);

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").notNull(),
    title: text("title").notNull(),
    status: recordingStatusEnum("status").notNull().default("uploading"),
    errorMessage: text("error_message"),
    originalFileName: text("original_file_name").notNull(),
    videoPath: text("video_path").notNull(),
    durationSeconds: real("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("recordings_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt,
    ),
  ],
);

export const processSteps = pgTable(
  "process_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordingId: uuid("recording_id")
      .notNull()
      .references(() => recordings.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    action: text("action").notNull(),
    system: text("system").notNull().default(""),
    testData: text("test_data").notNull().default(""),
    description: text("description").notNull().default(""),
    responsible: text("responsible").notNull().default(""),
    expectedResult: text("expected_result").notNull().default(""),
    timestampSeconds: real("timestamp_seconds").notNull().default(0),
    evidenceTimestampSeconds: real("evidence_timestamp_seconds")
      .notNull()
      .default(0),
    screenshotPath: text("screenshot_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("process_steps_recording_position_idx").on(
    table.recordingId,
    table.position,
  )],
);

export const recordingPublicShares = pgTable("recording_public_shares", {
  recordingId: uuid("recording_id")
    .primaryKey()
    .references(() => recordings.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const recordingsRelations = relations(recordings, ({ many }) => ({
  steps: many(processSteps),
}));

export const processStepsRelations = relations(processSteps, ({ one }) => ({
  recording: one(recordings, {
    fields: [processSteps.recordingId],
    references: [recordings.id],
  }),
}));
