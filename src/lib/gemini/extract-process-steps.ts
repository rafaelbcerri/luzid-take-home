import { createPartFromUri, createUserContent, FileState } from "@google/genai";
import { z } from "zod";

import { GEMINI_MODEL, gemini } from "@/lib/gemini/client";
import {
  STEP_EXTRACTION_INSTRUCTIONS,
  STEP_EXTRACTION_SCHEMA,
} from "@/lib/gemini/step-extraction-prompt";
import type { ExtractedProcess } from "@/lib/types/process-step";

const FILE_READY_POLL_INTERVAL_MS = 1_500;
const FILE_READY_TIMEOUT_MS = 3 * 60 * 1_000;

const extractedProcessSchema = z.object({
  title: z.string().trim().min(1).catch("Untitled process"),
  steps: z
    .array(
      z.object({
        action: z.string().trim().min(1),
        system: z.string().trim().default(""),
        description: z.string().trim().default(""),
        expectedResult: z.string().trim().default(""),
        timestampSeconds: z.number().min(0).catch(0),
      }),
    )
    .default([]),
});

/** Thrown when Gemini is reachable but cannot produce usable steps. */
export class StepExtractionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StepExtractionError";
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Uploads the video to the Gemini Files API and waits until it is ACTIVE.
 * Gemini rejects requests that reference a file still being processed.
 */
async function uploadVideoAndWaitUntilReady(params: {
  videoBytes: Buffer;
  mimeType: string;
}) {
  const uploadedFile = await gemini.files.upload({
    file: new Blob([new Uint8Array(params.videoBytes)], {
      type: params.mimeType,
    }),
    config: { mimeType: params.mimeType },
  });

  if (!uploadedFile.name) {
    throw new StepExtractionError(
      "Gemini did not return a file reference for this upload.",
    );
  }

  const deadline = Date.now() + FILE_READY_TIMEOUT_MS;
  let currentFile = uploadedFile;

  while (currentFile.state === FileState.PROCESSING) {
    if (Date.now() > deadline) {
      throw new StepExtractionError(
        "Gemini took too long to process this video. Try a shorter recording.",
      );
    }

    await wait(FILE_READY_POLL_INTERVAL_MS);
    currentFile = await gemini.files.get({ name: uploadedFile.name });
  }

  if (currentFile.state === FileState.FAILED || !currentFile.uri) {
    throw new StepExtractionError(
      "Gemini could not read this video. It may be corrupted or use an unsupported codec.",
    );
  }

  return { name: uploadedFile.name, uri: currentFile.uri };
}

/**
 * Turns a screen recording into an ordered list of documented steps.
 * Knows nothing about HTTP, the database or storage — it takes bytes and
 * returns plain objects, which keeps it easy to reason about and to test.
 */
export async function extractProcessSteps(params: {
  videoBytes: Buffer;
  mimeType: string;
}): Promise<ExtractedProcess> {
  const geminiFile = await uploadVideoAndWaitUntilReady(params);

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: createUserContent([
        createPartFromUri(geminiFile.uri, params.mimeType),
        STEP_EXTRACTION_INSTRUCTIONS,
      ]),
      config: {
        responseMimeType: "application/json",
        responseSchema: STEP_EXTRACTION_SCHEMA,
        temperature: 0.2,
      },
    });

    const rawJson = response.text;

    if (!rawJson) {
      throw new StepExtractionError(
        "Gemini returned an empty response for this video.",
      );
    }

    const parsed = extractedProcessSchema.safeParse(JSON.parse(rawJson));

    if (!parsed.success) {
      throw new StepExtractionError(
        "Gemini returned steps in an unexpected shape.",
        { cause: parsed.error },
      );
    }

    return {
      title: parsed.data.title,
      steps: parsed.data.steps.sort(
        (left, right) => left.timestampSeconds - right.timestampSeconds,
      ),
    };
  } finally {
    // The uploaded file has served its purpose; failing to clean it up must not
    // fail the extraction.
    void gemini.files.delete({ name: geminiFile.name }).catch(() => {});
  }
}
