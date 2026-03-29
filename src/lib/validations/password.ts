import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "password_min_length")
  .regex(/[A-Z]/, "password_uppercase")
  .regex(/[a-z]/, "password_lowercase")
  .regex(/[0-9]/, "password_number");
