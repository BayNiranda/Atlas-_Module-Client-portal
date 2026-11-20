// Standard wording pre-filled in new proposals, based on the structure of
// Atlas's own quotation letters (general wording only, no client details).
// Staff edit it per proposal.

export const DEFAULT_PAYMENT_TERMS =
  "50% of the fixed fee is payable on signing the engagement agreement and before work begins. " +
  "The remaining 50% is payable on delivery of the final deliverables. " +
  "Monthly fees are invoiced at the start of each month. All invoices are due within seven business days.";

export const DEFAULT_EXCLUSIONS =
  "External audit or review fees (payable directly to the audit firm); government registration and filing fees; " +
  "tax return preparation or back-filing unless listed above; any work not described in the scope above.";

export const DEFAULT_TERMS = [
  "Fees. Fees are fixed for the scope described above and exclude VAT and other applicable taxes, which will be added where required by Lao law.",
  "Client obligations. The client will provide requested documents and information within five business days, name a main contact who can give instructions, and disclose all information material to the engagement. Delays in providing information extend the timeline without additional charge.",
  "Changes to scope. Any change to the scope or fees must be agreed in writing by both parties before additional work begins.",
  "Termination. Either party may end the engagement with thirty (30) days' written notice. Fees are payable for work completed up to the date of termination.",
  "Confidentiality. Atlas Advisory keeps all client information confidential and uses it only for this engagement.",
  "Next step. On acceptance, Atlas Advisory will prepare the engagement agreement for signature.",
].join("\n\n");

export const DEFAULT_VALID_DAYS = 30;
