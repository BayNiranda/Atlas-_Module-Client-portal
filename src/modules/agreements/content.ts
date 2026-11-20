// What an agreement contains. The standard wording is copied into each agreement
// when it is prepared, so later template changes never alter an existing agreement.
import type { Billing, Currency } from "@/modules/proposals/money";
import {
  type Article, type Clause, DEFINITIONS, PAYMENT_GENERAL, SCOPE_INTRO, STANDARD_ARTICLES, TEMPLATE_VERSION,
} from "./template";

export type AgreementItem = { title: string; title_lo: string; deliverables: string; billing: Billing; amount: number };
export type AgreementContent = {
  template_version: number;
  client_name: string;
  proposal_ref: string;
  currency: Currency;
  items: AgreementItem[];
  payment_terms: Clause;
  payment_general: Clause;
  scope_intro: Clause;
  definitions: Article;
  articles: Article[];
};

export function buildContent(input: {
  clientName: string; proposalRef: string; currency: Currency; paymentTerms: string;
  items: { title: string; deliverables: string | null; billing: Billing; amount: number }[];
}): AgreementContent {
  return {
    template_version: TEMPLATE_VERSION,
    client_name: input.clientName,
    proposal_ref: input.proposalRef,
    currency: input.currency,
    items: input.items.map((i) => ({ title: i.title, title_lo: "", deliverables: i.deliverables ?? "", billing: i.billing, amount: Number(i.amount) })),
    payment_terms: { en: input.paymentTerms, lo: "" },
    payment_general: PAYMENT_GENERAL,
    scope_intro: SCOPE_INTRO,
    definitions: DEFINITIONS,
    articles: STANDARD_ARTICLES,
  };
}

// Dates written out in each language, e.g. "01 June 2026" / "01 ມິຖຸນາ 2026".
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_LO = ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];
export function longDate(iso: string, lang: "en" | "lo") {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${(lang === "en" ? MONTHS_EN : MONTHS_LO)[m - 1]} ${y}`;
}

// Months covered by a period with an inclusive end date, rounded up, for
// "Contract Duration": 01 Jun–31 Dec = 7, 15 Jan–14 Jul = 6, 01–15 Jun = 1.
export function durationMonths(start: string, end: string) {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const next = new Date(Date.UTC(y2, m2 - 1, d2)); // JavaScript months start at 0
  next.setUTCDate(next.getUTCDate() + 1); // the day after the period ends
  const months = (next.getUTCFullYear() - y1) * 12 + (next.getUTCMonth() + 1 - m1);
  return Math.max(1, months + (next.getUTCDate() > d1 ? 1 : 0));
}
