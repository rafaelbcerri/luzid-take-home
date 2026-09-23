import { GoogleGenAI } from "@google/genai";

import { env } from "@/lib/config/env";

/** Cached across hot reloads for the same reason as the database pool. */
const globalForGemini = globalThis as unknown as {
  geminiClient?: GoogleGenAI;
};

export const gemini =
  globalForGemini.geminiClient ?? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

if (env.NODE_ENV !== "production") {
  globalForGemini.geminiClient = gemini;
}

export const GEMINI_MODEL = env.GEMINI_MODEL;
