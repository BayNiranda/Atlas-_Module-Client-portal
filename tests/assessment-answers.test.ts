import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { answerText, missingRequired, progress, readAnswers, type Definition } from "@/modules/assessments/answers";

const def = JSON.parse(readFileSync("supabase/seed-data/pre-assessment-v1.json", "utf8")) as Definition;
const q = (id: string) => def.sections.flatMap((s) => s.questions).find((x) => x.id === id)!;

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("questionnaire definition", () => {
  it("has the owner's 8 sections and 56 questions with unique ids", () => {
    const ids = def.sections.flatMap((s) => s.questions.map((x) => x.id));
    expect(def.sections).toHaveLength(8);
    expect(ids).toHaveLength(56);
    expect(new Set(ids).size).toBe(56);
  });
  it("has no file-upload question (owner's rule)", () => {
    expect(def.sections.flatMap((s) => s.questions).some((x) => (x.type as string) === "file")).toBe(false);
  });
});

describe("reading answers", () => {
  it("keeps valid answers and drops unknown fields", () => {
    const { answers, problems } = readAnswers(def, form([
      ["1.1", "  Test Person "], ["1.5", "WhatsApp"], ["2.10", "LAK"], ["2.10", "USD"], ["3.10", "4"], ["8.1", "yes"], ["evil", "x"],
    ]));
    expect(problems).toEqual({});
    expect(answers).toEqual({ "1.1": "Test Person", "1.5": "WhatsApp", "2.10": ["LAK", "USD"], "3.10": "4", "8.1": "yes" });
  });

  it("rejects made-up options, bad emails, out-of-range scale and over-long text", () => {
    const { problems } = readAnswers(def, form([
      ["1.5", "Carrier pigeon"], ["1.3", "not-an-email"], ["3.10", "9"], ["2.4", "x".repeat(301)],
    ]));
    expect(Object.keys(problems).sort()).toEqual(["1.3", "1.5", "2.4", "3.10"]);
  });

  it("keeps 'please specify' text only when Other is chosen", () => {
    expect(readAnswers(def, form([["1.2", "Other (please specify)"], ["1.2:other", "Accountant"]])).answers["1.2:other"]).toBe("Accountant");
    expect(readAnswers(def, form([["1.2", "Owner / Founder"], ["1.2:other", "ignored"]])).answers["1.2:other"]).toBeUndefined();
  });

  it("lists missing required questions and counts progress", () => {
    const { answers } = readAnswers(def, form([["1.1", "Test"], ["8.1", "yes"]]));
    const missing = missingRequired(def, answers).map((x) => x.id);
    expect(missing).toContain("1.2");
    expect(missing).not.toContain("1.1");
    expect(missing).not.toContain("8.3"); // optional consent
    expect(progress(def, answers)).toEqual({ answered: 2, total: 56 });
  });

  it("shows answers as readable text", () => {
    expect(answerText(q("1.2"), { "1.2": "Other (please specify)", "1.2:other": "Accountant" })).toBe("Other (please specify): Accountant");
    expect(answerText(q("3.10"), { "3.10": "4" })).toBe("4 of 5");
    expect(answerText(q("1.1"), {})).toBeNull();
  });
});
