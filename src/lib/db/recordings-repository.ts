import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { processSteps, recordingPublicShares, recordings } from "@/lib/db/schema";
import type {
  ExtractedStep,
  ProcessStep,
  Recording,
  RecordingStatus,
  RecordingWithSteps,
  StepFieldUpdates,
} from "@/lib/types/process-step";

type RecordingRow = typeof recordings.$inferSelect;
type ProcessStepRow = typeof processSteps.$inferSelect;

function toRecording(row: RecordingRow): Recording {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
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
    system: row.system,
    testData: row.testData,
    description: row.description,
    responsible: row.responsible,
    expectedResult: row.expectedResult,
    timestampSeconds: row.timestampSeconds,
    evidenceTimestampSeconds: row.evidenceTimestampSeconds,
    screenshotPath: row.screenshotPath,
  };
}

export async function createRecording(params: {
  ownerUserId: string;
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

export async function listRecordings(ownerUserId: string): Promise<Recording[]> {
  const rows = await db
    .select()
    .from(recordings)
    .where(eq(recordings.ownerUserId, ownerUserId))
    .orderBy(desc(recordings.createdAt));

  return rows.map(toRecording);
}

export async function findRecording(
  recordingId: string,
  ownerUserId: string,
): Promise<Recording | null> {
  const [row] = await db
    .select()
    .from(recordings)
    .where(and(eq(recordings.id, recordingId), eq(recordings.ownerUserId, ownerUserId)))
    .limit(1);

  return row ? toRecording(row) : null;
}

export async function findRecordingWithSteps(
  recordingId: string,
  ownerUserId: string,
): Promise<RecordingWithSteps | null> {
  const recording = await findRecording(recordingId, ownerUserId);
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
          system: step.system,
          testData: step.testData,
          description: step.description,
          responsible: step.responsible,
          expectedResult: step.expectedResult,
          timestampSeconds: step.timestampSeconds,
        })),
      )
      .returning();

    return insertedRows.map(toProcessStep);
  });
}

export async function setStepEvidence(params: {
  stepId: string;
  screenshotPath: string;
  evidenceTimestampSeconds: number;
}): Promise<ProcessStep | null> {
  const [row] = await db
    .update(processSteps)
    .set({
      screenshotPath: params.screenshotPath,
      evidenceTimestampSeconds: params.evidenceTimestampSeconds,
    })
    .where(eq(processSteps.id, params.stepId))
    .returning();

  return row ? toProcessStep(row) : null;
}

export async function updateStep(
  params: { stepId: string; ownerUserId: string } & StepFieldUpdates,
): Promise<ProcessStep | null> {
  const { stepId, ownerUserId, ...changes } = params;

  const [row] = await db
    .update(processSteps)
    .set(changes)
    .where(and(eq(processSteps.id, stepId), ownedStepRecordingCondition(ownerUserId)))
    .returning();

  return row ? toProcessStep(row) : null;
}

export async function deleteStep(stepId: string, ownerUserId: string): Promise<ProcessStep | null> {
  const [row] = await db
    .delete(processSteps)
    .where(and(eq(processSteps.id, stepId), ownedStepRecordingCondition(ownerUserId)))
    .returning();

  return row ? toProcessStep(row) : null;
}

export async function deleteRecording(recordingId: string, ownerUserId: string): Promise<void> {
  await db.delete(recordings).where(
    and(eq(recordings.id, recordingId), eq(recordings.ownerUserId, ownerUserId)),
  );
}

function ownedStepRecordingCondition(ownerUserId: string) {
  return inArray(
    processSteps.recordingId,
    db.select({ id: recordings.id })
      .from(recordings)
      .where(eq(recordings.ownerUserId, ownerUserId)),
  );
}

export class InvalidStepOrderError extends Error {
  constructor() {
    super("The new step order does not match this script.");
  }
}

/** Persists a new order by writing each step's index as its position. */
export async function reorderSteps(params: {
  recordingId: string;
  ownerUserId: string;
  orderedStepIds: string[];
}): Promise<ProcessStep[] | null> {
  if (!(await findRecording(params.recordingId, params.ownerUserId))) return null;

  await db.transaction(async (transaction) => {
    const existingSteps = await transaction
      .select({ id: processSteps.id })
      .from(processSteps)
      .where(eq(processSteps.recordingId, params.recordingId));
    const existingIds = new Set(existingSteps.map((step) => step.id));
    const orderedIds = new Set(params.orderedStepIds);

    if (
      orderedIds.size !== existingIds.size ||
      params.orderedStepIds.length !== existingIds.size ||
      params.orderedStepIds.some((stepId) => !existingIds.has(stepId))
    ) {
      throw new InvalidStepOrderError();
    }

    for (const [position, stepId] of params.orderedStepIds.entries()) {
      await transaction
        .update(processSteps)
        .set({ position })
        .where(and(eq(processSteps.id, stepId), eq(processSteps.recordingId, params.recordingId)));
    }
  });

  return listStepsForRecording(params.recordingId);
}

export async function appendStep(params: {
  recordingId: string;
  ownerUserId: string;
}): Promise<ProcessStep | null> {
  if (!(await findRecording(params.recordingId, params.ownerUserId))) return null;
  const existingSteps = await listStepsForRecording(params.recordingId);
  const nextPosition = existingSteps.length;
  const lastTimestamp = existingSteps.at(-1)?.timestampSeconds ?? 0;

  const [row] = await db
    .insert(processSteps)
    .values({
      recordingId: params.recordingId,
      position: nextPosition,
      action: "New step",
      system: "",
      testData: "",
      description: "",
      responsible: "",
      expectedResult: "",
      timestampSeconds: lastTimestamp,
      evidenceTimestampSeconds: lastTimestamp,
    })
    .returning();

  return toProcessStep(row);
}

/** A step plus the recording it belongs to — what the frame picker needs in one read. */
export async function findStepWithRecording(
  stepId: string,
  ownerUserId: string,
): Promise<{ step: ProcessStep; recording: Recording } | null> {
  const [row] = await db
    .select()
    .from(processSteps)
    .innerJoin(recordings, eq(processSteps.recordingId, recordings.id))
    .where(and(eq(processSteps.id, stepId), eq(recordings.ownerUserId, ownerUserId)))
    .limit(1);

  if (!row) return null;

  return {
    step: toProcessStep(row.process_steps),
    recording: toRecording(row.recordings),
  };
}

export async function renameRecording(params: {
  recordingId: string;
  ownerUserId: string;
  title: string;
}): Promise<Recording | null> {
  const [row] = await db
    .update(recordings)
    .set({ title: params.title, updatedAt: new Date() })
    .where(and(eq(recordings.id, params.recordingId), eq(recordings.ownerUserId, params.ownerUserId)))
    .returning();

  return row ? toRecording(row) : null;
}

/**
 * Inserts an empty step directly below another one, shifting everything after
 * it down. `afterStepId` of null puts the new step first.
 */
export async function insertStepAfter(params: {
  recordingId: string;
  ownerUserId: string;
  afterStepId: string | null;
}): Promise<ProcessStep | null> {
  if (!(await findRecording(params.recordingId, params.ownerUserId))) return null;

  return db.transaction(async (transaction) => {
    const existingSteps = await transaction
      .select()
      .from(processSteps)
      .where(eq(processSteps.recordingId, params.recordingId))
      .orderBy(asc(processSteps.position));

    const afterIndex = params.afterStepId
      ? existingSteps.findIndex((step) => step.id === params.afterStepId)
      : -1;
    if (params.afterStepId && afterIndex === -1) return null;
    const insertAt = afterIndex + 1;
    const timestampSeconds =
      existingSteps[afterIndex]?.timestampSeconds ??
      existingSteps[0]?.timestampSeconds ??
      0;

    await Promise.all(
      existingSteps.slice(insertAt).map((step, offset) =>
        transaction
          .update(processSteps)
          .set({ position: insertAt + offset + 1 })
          .where(eq(processSteps.id, step.id)),
      ),
    );

    const [row] = await transaction
      .insert(processSteps)
      .values({
        recordingId: params.recordingId,
        position: insertAt,
        action: "New step",
        system: "",
        testData: "",
        description: "",
        responsible: "",
        expectedResult: "",
        timestampSeconds,
        evidenceTimestampSeconds: timestampSeconds,
      })
      .returning();

    return toProcessStep(row);
  });
}

export type RecordingShare = { token: string; createdAt: string };

export async function findShareForOwner(
  recordingId: string,
  ownerUserId: string,
): Promise<RecordingShare | null> {
  const [row] = await db
    .select({ token: recordingPublicShares.token, createdAt: recordingPublicShares.createdAt })
    .from(recordingPublicShares)
    .innerJoin(recordings, eq(recordingPublicShares.recordingId, recordings.id))
    .where(and(eq(recordings.id, recordingId), eq(recordings.ownerUserId, ownerUserId)))
    .limit(1);
  return row ? { token: row.token, createdAt: row.createdAt.toISOString() } : null;
}

export async function createShareForOwner(
  recordingId: string,
  ownerUserId: string,
): Promise<RecordingShare | null> {
  if (!(await findRecording(recordingId, ownerUserId))) return null;
  const [created] = await db
    .insert(recordingPublicShares)
    .values({ recordingId, token: randomBytes(32).toString("base64url") })
    .onConflictDoNothing()
    .returning();
  if (created) return { token: created.token, createdAt: created.createdAt.toISOString() };
  return findShareForOwner(recordingId, ownerUserId);
}

export async function revokeShareForOwner(
  recordingId: string,
  ownerUserId: string,
): Promise<boolean> {
  if (!(await findRecording(recordingId, ownerUserId))) return false;
  await db.delete(recordingPublicShares).where(eq(recordingPublicShares.recordingId, recordingId));
  return true;
}

export async function findPublicRecordingByToken(
  token: string,
): Promise<RecordingWithSteps | null> {
  const [row] = await db
    .select({ recording: recordings })
    .from(recordingPublicShares)
    .innerJoin(recordings, eq(recordingPublicShares.recordingId, recordings.id))
    .where(eq(recordingPublicShares.token, token))
    .limit(1);
  if (!row) return null;
  return {
    ...toRecording(row.recording),
    steps: await listStepsForRecording(row.recording.id),
  };
}

export async function findPublicScreenshotByToken(
  token: string,
  stepId: string,
): Promise<{ screenshotPath: string | null } | null> {
  const [row] = await db
    .select({ screenshotPath: processSteps.screenshotPath })
    .from(recordingPublicShares)
    .innerJoin(processSteps, eq(recordingPublicShares.recordingId, processSteps.recordingId))
    .where(and(eq(recordingPublicShares.token, token), eq(processSteps.id, stepId)))
    .limit(1);
  return row ?? null;
}
