"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseInquiryForm, type InquiryState } from "./schema";

const GENERIC_ERROR = "Something went wrong. Please try again, or contact us on WhatsApp.";

// Public inquiry form. Visitors never touch the database directly: this code checks
// everything first, then calls the one database function allowed to save inquiries.
export async function submitInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const values = {
    company_name: String(formData.get("company_name") ?? ""),
    contact_name: String(formData.get("contact_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    company_size: String(formData.get("company_size") ?? ""),
    services: formData.getAll("services").map(String),
    challenge: String(formData.get("challenge") ?? ""),
    preferred_date: String(formData.get("preferred_date") ?? ""),
  };

  // Honeypot: real people never see or fill this field. Pretend success, save nothing.
  if (String(formData.get("website") ?? "") !== "") {
    return { status: "success", reference: null, contactName: values.contact_name };
  }

  const parsed = parseInquiryForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", fieldErrors, values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "";

  if (!(await passesTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip))) {
    return { status: "error", message: "The spam check failed. Please try again.", fieldErrors: {}, values };
  }

  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("Missing environment variable IP_HASH_SALT.");
  // Store only a scrambled fingerprint of the IP: enough to rate-limit, not to identify anyone.
  const ipHash = ip ? createHash("sha256").update(salt + ip).digest("hex") : null;

  const d = parsed.data;
  const { data: reference, error } = await createAdminClient().rpc("submit_inquiry", {
    p_company_name: d.company_name,
    p_contact_name: d.contact_name,
    p_email: d.email,
    p_phone: d.phone,
    p_industry: d.industry,
    p_company_size: d.company_size,
    p_challenge: d.challenge,
    p_preferred_date: d.preferred_date || null,
    p_service_slugs: d.services,
    p_ip_hash: ipHash,
  });

  if (error) {
    if (error.message.includes("rate_limited")) {
      return { status: "error", message: "Too many inquiries from your connection. Please try again in an hour, or contact us on WhatsApp.", fieldErrors: {}, values };
    }
    if (error.message.includes("invalid_service")) {
      return { status: "error", fieldErrors: { services: "Choose at least one service" }, values };
    }
    console.error("submit_inquiry failed", error.message);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {}, values };
  }

  return { status: "success", reference: reference as string, contactName: d.contact_name };
}

async function passesTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("Missing environment variable TURNSTILE_SECRET_KEY.");
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}
