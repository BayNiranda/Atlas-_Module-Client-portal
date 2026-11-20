import { describe, expect, it } from "vitest";
import { formatMoney, parseAmount, totalsByBilling } from "@/modules/proposals/money";
import { proposalFormSchema } from "@/modules/proposals/schema";

describe("money", () => {
  it("formats LAK without decimals and USD with cents only when needed", () => {
    expect(formatMoney(6500000, "LAK", "monthly")).toBe("LAK 6,500,000 / month");
    expect(formatMoney(4000, "USD")).toBe("USD 4,000");
    expect(formatMoney(1250.5, "USD")).toBe("USD 1,250.50");
    expect(formatMoney("300", "THB", "yearly")).toBe("THB 300 / year");
  });

  it("parses typed amounts and rejects bad ones", () => {
    expect(parseAmount("6,500,000", "LAK")).toBe(6500000);
    expect(parseAmount("1250.50", "USD")).toBe(1250.5);
    expect(parseAmount("12.5", "LAK")).toBeNull(); // whole kip only
    expect(parseAmount("-5", "USD")).toBeNull();
    expect(parseAmount("1.234", "USD")).toBeNull();
    expect(parseAmount("abc", "USD")).toBeNull();
  });

  it("totals per billing type without floating-point drift", () => {
    const t = totalsByBilling([
      { billing: "fixed", amount: 0.1 }, { billing: "fixed", amount: 0.2 },
      { billing: "monthly", amount: 250 }, { billing: "monthly", amount: 50 },
    ]);
    expect(t).toEqual([{ billing: "fixed", amount: 0.3 }, { billing: "monthly", amount: 300 }]);
  });

  it("the proposal form rejects a bad fee with a clear message", () => {
    const r = proposalFormSchema.safeParse({
      organization_id: "00000000-0000-4000-8000-000000000000", title: "x", currency: "LAK", valid_until: "2026-12-31",
      introduction: "", exclusions: "", payment_terms: "", terms: "",
      items: [{ service_id: "", title: "Bookkeeping", scope: "", deliverables: "", billing: "monthly", amount: "12.5" }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain("whole kip");
  });
});
