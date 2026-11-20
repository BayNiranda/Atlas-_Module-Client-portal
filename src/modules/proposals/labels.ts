// Proposal statuses as shown to people. "Expired" is not stored: a sent
// proposal past its "valid until" date (Lao time) is shown and treated as expired.

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Awaiting decision", accepted: "Accepted", declined: "Declined",
  superseded: "Superseded", withdrawn: "Withdrawn", expired: "Expired",
};

export function laoToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane" }).format(new Date()); // YYYY-MM-DD
}

export function displayStatus(p: { status: string; valid_until: string }) {
  return p.status === "sent" && p.valid_until < laoToday() ? "expired" : p.status;
}

export function statusTone(s: string) {
  if (s === "accepted") return "green";
  if (s === "declined" || s === "withdrawn" || s === "expired") return "red";
  if (s === "sent" || s === "draft") return "gold";
  return "grey";
}

export const proposalRef = (p: { number: string; version: number }) => `${p.number} v${p.version}`;

// Messages for errors raised by the database functions.
export const PROPOSAL_ERRORS: Record<string, string> = {
  not_allowed: "You do not have permission to do this.",
  not_draft: "Only a draft can be sent.",
  assessment_not_approved: "The client's pre-assessment must be approved before a proposal can be sent.",
  validity_passed: "The 'valid until' date has passed. Change it before sending.",
  no_items: "Add at least one fee line before sending.",
  not_open: "This proposal is no longer open.",
  expired: "This proposal has expired. Please ask Atlas for an updated one.",
  cannot_revise: "This proposal cannot be revised.",
  proposal_locked: "A sent proposal cannot be changed. Revise it to make a new version.",
};
export const explainProposalError = (message: string) =>
  Object.entries(PROPOSAL_ERRORS).find(([k]) => message.includes(k))?.[1] ?? "Could not save. Please try again.";
