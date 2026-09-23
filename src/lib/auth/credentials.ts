import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
});

export const newPasswordSchema = z
  .string()
  .min(8, "Choose a password with at least 8 characters.");
