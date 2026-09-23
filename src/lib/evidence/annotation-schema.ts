import { z } from "zod";

const annotationSchema = z.object({
  kind: z.enum(["rectangle", "square"]),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  width: z.number().finite().positive().max(1),
  height: z.number().finite().positive().max(1),
}).refine((annotation) => annotation.x + annotation.width <= 1.000001 && annotation.y + annotation.height <= 1.000001);

export const evidenceAnnotationsSchema = z.array(annotationSchema).max(20);
