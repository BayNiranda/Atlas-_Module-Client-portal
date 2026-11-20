// Money helpers. Amounts are handled as whole cents (integers) so totals never
// suffer floating-point rounding errors.

export const CURRENCIES = ["LAK", "USD", "THB"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const BILLING = [["fixed", "Fixed fee"], ["monthly", "Per month"], ["yearly", "Per year"]] as const;
export type Billing = (typeof BILLING)[number][0];
const SUFFIX: Record<Billing, string> = { fixed: "", monthly: " / month", yearly: " / year" };

// LAK has no minor unit in practice; USD/THB show cents only when needed.
export function formatMoney(amount: number | string, currency: Currency, billing: Billing = "fixed") {
  const n = typeof amount === "string" ? Number(amount) : amount;
  const digits = currency === "LAK" ? 0 : Number.isInteger(n) ? 0 : 2;
  const text = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  return `${currency} ${text}${SUFFIX[billing]}`;
}

// "6,500,000" or "1250.50" -> 1250.5 ; returns null if not a valid amount.
export function parseAmount(raw: string, currency: Currency): number | null {
  const clean = raw.replace(/[,\s]/g, "");
  if (!/^\d{1,14}(\.\d{1,2})?$/.test(clean)) return null;
  const n = Number(clean);
  if (currency === "LAK" && !Number.isInteger(n)) return null;
  return n;
}

// Totals per billing type (fixed fees are never added to monthly fees).
export function totalsByBilling(items: { billing: Billing; amount: number | string }[]) {
  const cents = new Map<Billing, number>();
  for (const i of items) cents.set(i.billing, (cents.get(i.billing) ?? 0) + Math.round(Number(i.amount) * 100));
  return BILLING.filter(([b]) => cents.has(b)).map(([b]) => ({ billing: b, amount: cents.get(b)! / 100 }));
}
