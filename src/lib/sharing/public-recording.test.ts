import { expect, it } from "vitest";

import { toPublicRecording } from "./public-recording";

it("exposes only script fields and revocable screenshot routes", () => {
  const token = "public-token";
  const recording = {
    id: "recording-id",
    ownerUserId: "owner-id",
    title: "Client approval",
    status: "ready" as const,
    errorMessage: "private error",
    originalFileName: "sensitive.mp4",
    videoPath: "private/source.mp4",
    durationSeconds: 10,
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: "step-one",
        recordingId: "recording-id",
        position: 0,
        action: "Approve request",
        system: "ERP",
        testData: "A1",
        description: "Open the request",
        responsible: "Consultant",
        expectedResult: "Approved",
        timestampSeconds: 2,
        evidenceTimestampSeconds: 3,
        screenshotPath: "private/one.png",
      },
      {
        id: "step-two",
        recordingId: "recording-id",
        position: 1,
        action: "Confirm status",
        system: "ERP",
        testData: "",
        description: "",
        responsible: "",
        expectedResult: "Approved",
        timestampSeconds: 4,
        evidenceTimestampSeconds: 4,
        screenshotPath: null,
      },
    ],
  };

  const publicRecording = toPublicRecording(recording, token);
  expect(publicRecording.title).toBe("Client approval");
  expect(publicRecording.steps[0].screenshotUrl).toBe(
    "/share/public-token/screenshots/step-one",
  );
  expect(publicRecording.steps[1].screenshotUrl).toBeNull();
  expect(JSON.stringify(publicRecording)).not.toMatch(
    /videoPath|originalFileName|ownerUserId|errorMessage|screenshotPath|recordingId|private\/source/,
  );
});
