import { z } from "zod";

const MAX_TITLE_LENGTH = 200;

export const recordingTitleSchema = z
  .string()
  .trim()
  .min(1, "A script needs a name so it can be found again.")
  .max(MAX_TITLE_LENGTH, "Keep the name under 200 characters.");
