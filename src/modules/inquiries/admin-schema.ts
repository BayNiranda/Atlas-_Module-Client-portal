import { z } from "zod";
import { CONSULTATION_MODES, CONSULTATION_STATUSES, MANUAL_STAGES, QUALIFICATIONS } from "./labels";

const uuid = z.uuid();
const optionalUuid = z.union([z.uuid(), z.literal("")]);
const keys = <T extends readonly (readonly [string, string])[]>(list: T) => list.map(([k]) => k) as [T[number][0], ...T[number][0][]];

export const updateInquirySchema = z.object({
  id: uuid,
  status: z.enum(MANUAL_STAGES).optional(),
  assigned_to: optionalUuid,
  qualification: z.union([z.enum(keys(QUALIFICATIONS)), z.literal("")]),
});

export const noteSchema = z.object({
  entity_id: uuid,
  body: z.string().trim().min(1, "Write a note first").max(5000, "Keep notes under 5000 characters"),
});

export const leadSchema = z.object({
  source: z.enum(["whatsapp", "referral", "other"]),
  company_name: z.string().trim().min(1, "Enter the company name").max(200),
  contact_name: z.string().trim().min(1, "Enter a contact name").max(120),
  phone: z.string().trim().max(40).refine((v) => v.replace(/\D/g, "").length >= 8, "Enter a phone or WhatsApp number"),
  email: z.union([z.string().trim().max(254).pipe(z.email("Enter a valid email address")), z.literal("")]),
  services: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1, "Choose at least one service").max(10).transform((s) => [...new Set(s)]),
  challenge: z.string().trim().min(1, "Summarise what they need").max(4000),
});

// Lao time is UTC+7 all year, so a local "YYYY-MM-DDTHH:mm" becomes an exact moment.
export const consultationSchema = z.object({
  inquiry_id: uuid,
  consultant_id: uuid,
  scheduled_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time")
    .transform((v) => new Date(`${v}:00+07:00`).toISOString()),
  mode: z.enum(keys(CONSULTATION_MODES)),
  location: z.string().trim().max(300),
});

export const consultationStatusSchema = z.object({
  id: uuid,
  inquiry_id: uuid,
  status: z.enum(keys(CONSULTATION_STATUSES)),
});

export const convertSchema = z.object({
  inquiry_id: uuid,
  org_name: z.string().trim().min(1, "Enter the organization name").max(200),
  full_name: z.string().trim().min(1, "Enter the client's name").max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
});

export type ActionResult = { ok?: boolean; error?: string; message?: string; link?: string; email?: string; whatsapp?: string };
export const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Please check the form.";
