import { z } from "zod";
import { CURRENCIES, parseAmount } from "./money";

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);

const itemSchema = z.object({
  service_id: z.union([z.uuid(), z.literal("")]),
  title: z.string().trim().min(1, "Every fee line needs a title").max(200),
  scope: text(5000),
  deliverables: text(5000),
  billing: z.enum(["fixed", "monthly", "yearly"]),
  amount: z.string(),
});

export const proposalFormSchema = z
  .object({
    organization_id: z.uuid("Choose the client company"),
    title: z.string().trim().min(1, "Enter a title").max(200),
    currency: z.enum(CURRENCIES),
    valid_until: z.iso.date("Choose a 'valid until' date"),
    introduction: text(5000),
    exclusions: text(5000),
    payment_terms: text(5000),
    terms: text(20000),
    items: z.array(itemSchema).max(50, "Up to 50 fee lines"),
  })
  .transform((d, ctx) => {
    const items = d.items.map((i, idx) => {
      const amount = parseAmount(i.amount, d.currency);
      if (amount === null) {
        ctx.addIssue({
          code: "custom",
          path: ["items", idx, "amount"],
          message: `Line ${idx + 1}: enter a valid fee${d.currency === "LAK" ? " (whole kip, no decimals)" : ""}`,
        });
      }
      return { ...i, amount: amount ?? 0 };
    });
    return { ...d, items };
  });

export type ProposalForm = z.output<typeof proposalFormSchema>;
export type ProposalItemInput = z.input<typeof itemSchema>;
