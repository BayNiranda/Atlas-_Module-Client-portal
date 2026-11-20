import { z } from "zod";

export const INDUSTRIES = [
  "Wholesale & distribution", "Retail", "Manufacturing", "Construction",
  "Hospitality", "Agriculture", "Professional services", "Other",
] as const;
export const COMPANY_SIZES = ["1–20", "21–50", "51–200", "200+"] as const;

const trimmed = (max: number, msg: string) => z.string().trim().min(1, msg).max(max, `Keep this under ${max} characters`);

// Same messages as the owner's prototype.
export const inquirySchema = z.object({
  company_name: trimmed(200, "Enter your company name"),
  contact_name: trimmed(120, "Enter a contact name"),
  email: z.string().trim().max(254).pipe(z.email("Enter a valid email address")),
  phone: z.string().trim().max(40).refine((v) => v.replace(/\D/g, "").length >= 8, "Enter a phone or WhatsApp number"),
  industry: z.enum(INDUSTRIES, { error: "Choose an industry" }),
  company_size: z.union([z.enum(COMPANY_SIZES), z.literal("")]).default(""),
  services: z
    .array(z.string().regex(/^[a-z0-9-]+$/))
    .min(1, "Choose at least one service")
    .max(10)
    .transform((s) => [...new Set(s)]),
  challenge: z.string().trim().min(10, "Describe your challenge in a few words").max(4000, "Keep this under 4000 characters"),
  preferred_date: z.union([z.iso.date("Enter a valid date"), z.literal("")]).default(""),
  consent: z.literal("on", { error: "Please confirm we may contact you" }),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export function parseInquiryForm(formData: FormData) {
  return inquirySchema.safeParse({
    company_name: formData.get("company_name") ?? "",
    contact_name: formData.get("contact_name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    industry: formData.get("industry") ?? "",
    company_size: formData.get("company_size") ?? "",
    services: formData.getAll("services"),
    challenge: formData.get("challenge") ?? "",
    preferred_date: formData.get("preferred_date") ?? "",
    consent: formData.get("consent") ?? undefined,
  });
}

export type InquiryState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors: Record<string, string>; values: Record<string, string | string[]> }
  | { status: "success"; reference: string | null; contactName: string };
