import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { processSteps, recordings } from "@/lib/db/schema";
import type {
  ExtractedStep,
  ProcessStep,
  Recording,
  RecordingStatus,
  RecordingWithSteps,
} from "@/lib/types/process-step";

type RecordingRow = typeof recordings.$inferSelect;
type ProcessStepRow = typeof processSteps.$inferSelect;

function toRecording(row: RecordingRow): Recording {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    errorMessage: row.errorMessage,
    originalFileName: row.originalFileName,
    videoPath: row.videoPath,
    durationSeconds: row.durationSeconds,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProcessStep(row: ProcessStepRow): ProcessStep {
  return {
    id: row.id,
    recordingId: row.recordingId,
    position: row.position,
    action: row.action,
    description: row.description,
    expectedResult: row.expectedResult,
    timestampSeconds: row.timestampSeconds,
    screenshotPath: row.screenshotPath,
  };
}

export async function createRecording(params: {
  title: string;
  originalFileName: string;
  videoPath: string;
  durationSeconds: number;
}): Promise<Recording> {
  const [row] = await db
    .insert(recordings)
    .values({ ...params, status: "analyzing" })
    .returning();

  return toRecording(row);
}

export async function updateRecordingStatus(params: {
  recordingId: string;
  status: RecordingStatus;
  errorMessage?: string | null;
  title?: string;
}): Promise<void> {
  await db
    .update(recordings)
    .set({
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      ...(params.title ? { title: params.title } : {}),
      updatedAt: new Date(),
    })
    .where(eq(recordings.id, params.recordingId));
}

export async function listRecordings(): Promise<Recording[]> {
  const rows = await db
    .select()
    .from(recordings)
    .orderBy(desc(recordings.createdAt));

  return rows.map(toRecording);
}

export async function findRecording(
  recordingId: string,
): Promise<Recording | null> {
  const [row] = await db
    .select()
    .from(recordings)
    .where(eq(recordings.id, recordingId))
    .limit(1);

  return row ? toRecording(row) : null;
}

export async function findRecordingWithSteps(
  recordingId: string,
): Promise<RecordingWithSteps | null> {
  const recording = await findRecording(recordingId);
  if (!recording) return null;

  return { ...recording, steps: await listStepsForRecording(recordingId) };
}

export async function listStepsForRecording(
  recordingId: string,
): Promise<ProcessStep[]> {
  const rows = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.recordingId, recordingId))
    .orderBy(asc(processSteps.position));

  return rows.map(toProcessStep);
}

/** Replaces every step of a recording — used when (re)running the pipeline. */
export async function replaceSteps(params: {
  recordingId: string;
  steps: ExtractedStep[];
}): Promise<ProcessStep[]> {
  return db.transaction(async (transaction) => {
    await transaction
      .delete(processSteps)
      .where(eq(processSteps.recordingId, params.recordingId));

    if (params.steps.length === 0) return [];

    const insertedRows = await transaction
      .insert(processSteps)
      .values(
        params.steps.map((step, index) => ({
          recordingId: params.recordingId,
          position: index,
          action: step.action,
          description: step.description,
          expectedResult: step.expectedResult,
          timestampSeconds: step.timestampSeconds,
        })),
      )
      .returning();

    return insertedRows.map(toProcessStep);
  });
}

export async function setStepScreenshotPath(params: {
  stepId: string;
  screenshotPath: string;
}): Promise<void> {
  await db
    .update(processSteps)
    .set({ screenshotPath: params.screenshotPath })
    .where(eq(processSteps.id, params.stepId));
}

export async function updateStep(params: {
  stepId: string;
  action?: string;
  description?: string;
  expectedResult?: string;
}): Promise<ProcessStep | null> {
  const [row] = await db
    .update(processSteps)
    .set({
      ...(params.action !== undefined ? { action: params.action } : {}),
      ...(params.description !== undefined
        ? { description: params.description }
        : {}),
      ...(params.expectedResult !== undefined
        ? { expectedResult: params.expectedResult }
        : {}),
    })
    .where(eq(processSteps.id, params.stepId))
    .returning();

  return row ? toProcessStep(row) : null;
}

export async function deleteStep(stepId: string): Promise<ProcessStep | null> {
  const [row] = await db
    .delete(processSteps)
    .where(eq(processSteps.id, stepId))
    .returning();

  return row ? toProcessStep(row) : null;
}

export async function deleteRecording(recordingId: string): Promise<void> {
  await db.delete(recordings).where(eq(recordings.id, recordingId));
}

/** Persists a new order by writing each step's index as its position. */
export async function reorderSteps(params: {
  recordingId: string;
  orderedStepIds: string[];
}): Promise<ProcessStep[]> {
  await db.transaction(async (transaction) => {
    await Promise.all(
      params.orderedStepIds.map((stepId, index) =>
        transaction
          .update(processSteps)
          .set({ position: index })
          .where(eq(processSteps.id, stepId)),
      ),
    );
  });

  return listStepsForRecording(params.recordingId);
}

export async function appendStep(params: {
  recordingId: string;
}): Promise<ProcessStep> {
  const existingSteps = await listStepsForRecording(params.recordingId);
  const nextPosition = existingSteps.length;
  const lastTimestamp = existingSteps.at(-1)?.timestampSeconds ?? 0;

  const [row] = await db
    .insert(processSteps)
    .values({
      recordingId: params.recordingId,
      position: nextPosition,
      action: "New step",
      description: "",
      expectedResult: "",
      timestampSeconds: lastTimestamp,
    })
    .returning();

  return toProcessStep(row);
}
