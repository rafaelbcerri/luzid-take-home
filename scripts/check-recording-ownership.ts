import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { env } from "../src/lib/config/env";
import {
  appendStep,
  createRecording,
  deleteRecording,
  deleteStep,
  findRecording,
  findStepWithRecording,
  listRecordings,
  reorderSteps,
  updateStep,
} from "../src/lib/db/recordings-repository";

async function createFixtureUser(label: string): Promise<string> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: `ownership-${label}-${randomUUID()}@example.com`,
      password: `Test-${randomUUID()}`,
      email_confirm: true,
    }),
  });
  if (!response.ok) throw new Error(`Could not create fixture user: ${response.status}`);
  const user = (await response.json()) as { id: string };
  return user.id;
}

async function deleteFixtureUser(userId: string): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

async function main() {
const ownerA = await createFixtureUser("a");
const ownerB = await createFixtureUser("b");
let recordingA: Awaited<ReturnType<typeof createRecording>> | null = null;
let recordingB: Awaited<ReturnType<typeof createRecording>> | null = null;

try {
  recordingA = await createRecording({
    ownerUserId: ownerA,
    title: "Owner A",
    originalFileName: "a.mp4",
    videoPath: `test/${randomUUID()}/a.mp4`,
    durationSeconds: 1,
  });
  recordingB = await createRecording({
    ownerUserId: ownerB,
    title: "Owner B",
    originalFileName: "b.mp4",
    videoPath: `test/${randomUUID()}/b.mp4`,
    durationSeconds: 1,
  });

  const ownerAList = await listRecordings(ownerA);
  const ownerBList = await listRecordings(ownerB);
  assert(ownerAList.some((row) => row.id === recordingA?.id));
  assert(!ownerAList.some((row) => row.id === recordingB?.id));
  assert(ownerBList.some((row) => row.id === recordingB?.id));
  assert(!ownerBList.some((row) => row.id === recordingA?.id));
  assert.equal(await findRecording(recordingA.id, ownerB), null);

  const step = await appendStep({ recordingId: recordingA.id, ownerUserId: ownerA });
  assert(step);
  assert.equal(await findStepWithRecording(step.id, ownerB), null);
  assert.equal(await updateStep({ stepId: step.id, ownerUserId: ownerB, action: "Not allowed" }), null);
  assert.equal(await deleteStep(step.id, ownerB), null);
  assert.equal(await reorderSteps({
    recordingId: recordingA.id,
    ownerUserId: ownerB,
    orderedStepIds: [step.id],
  }), null);
  console.log("Ownership integration check passed for two users.");
} finally {
  if (recordingA) await deleteRecording(recordingA.id, ownerA);
  if (recordingB) await deleteRecording(recordingB.id, ownerB);
  await deleteFixtureUser(ownerA);
  await deleteFixtureUser(ownerB);
}
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
