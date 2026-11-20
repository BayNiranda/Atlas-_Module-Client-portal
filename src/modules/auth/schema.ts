import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const newPasswordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export type FormState = { error?: string } | undefined;
