export const CATEGORIES = [
  ["registration_legal", "Registration & legal"], ["tax", "Tax"], ["bank_statements", "Bank statements"],
  ["financial_statements", "Financial statements"], ["payroll", "Payroll"], ["contracts", "Contracts"],
  ["atlas_reports", "Reports from Atlas"], ["other", "Other"],
] as const;
export type Category = (typeof CATEGORIES)[number][0];
export const categoryLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;

export const DOC_STATUS: Record<string, string> = { received: "Under review", accepted: "Accepted", rejected: "Needs replacing" };
export const docTone = (s: string) => (s === "accepted" ? "green" : s === "rejected" ? "red" : "gold");

export const REQUEST_STATUS: Record<string, string> = { open: "Missing", fulfilled: "Received", cancelled: "Cancelled" };
export const requestTone = (s: string) => (s === "fulfilled" ? "green" : s === "open" ? "red" : "grey");

export const fmtSize = (bytes: number) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.csv";
