// Display labels shared by admin screens and server checks.
export const STAGES = [
  ["new", "New"], ["discussion", "Discussion"], ["consultation", "Consultation"],
  ["pre_assessment", "Pre-assessment"], ["proposal", "Proposal"], ["agreement", "Agreement"],
  ["won", "Won"], ["not_a_fit", "Not a fit"], ["spam", "Spam"],
] as const;
export type Stage = (typeof STAGES)[number][0];
export const stageLabel = (s: string) => STAGES.find(([k]) => k === s)?.[1] ?? s;

// Stages staff may set by hand in Module 2. Later stages are set by their own steps.
export const MANUAL_STAGES = ["new", "discussion", "consultation", "not_a_fit", "spam"] as const;

export const SOURCES = [["web_form", "Web form"], ["whatsapp", "WhatsApp"], ["referral", "Referral"], ["other", "Other"]] as const;
export const sourceLabel = (s: string) => SOURCES.find(([k]) => k === s)?.[1] ?? s;

export const QUALIFICATIONS = [
  ["low", "Low complexity · capacity available"],
  ["medium", "Medium complexity · capacity available"],
  ["high", "High complexity · check capacity"],
  ["outside", "Outside our services"],
] as const;

export const CONSULTATION_MODES = [["in_person", "In person"], ["online", "Online"], ["phone", "Phone"]] as const;
export const CONSULTATION_STATUSES = [["scheduled", "Scheduled"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["no_show", "No-show"]] as const;
export const modeLabel = (m: string) => CONSULTATION_MODES.find(([k]) => k === m)?.[1] ?? m;
export const consultationStatusLabel = (s: string) => CONSULTATION_STATUSES.find(([k]) => k === s)?.[1] ?? s;

export const STAFF_ROLES = [
  ["SUPER_ADMIN", "Super admin"], ["ADMIN", "Admin"],
  ["PROJECT_COORDINATOR", "Project coordinator"], ["CONSULTANT", "Consultant"],
] as const;
export const roleLabel = (r: string | null) => STAFF_ROLES.find(([k]) => k === r)?.[1] ?? "—";

export function stageTone(s: string) {
  if (s === "won") return "green";
  if (s === "not_a_fit" || s === "spam") return "red";
  if (s === "new") return "grey";
  return "gold";
}

// Dates shown in Lao time (UTC+7, no daylight saving).
export const TZ = "Asia/Vientiane";
export const fmtDate = (d: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
export const fmtDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
