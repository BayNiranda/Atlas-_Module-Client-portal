// The questionnaire's shape and how answers are read from the form.
// Pure functions: used by the browser (progress), the server (before saving),
// and tests. The database repeats the same checks (assessment_answers_problem).

export type QuestionType =
  | "short_text" | "long_text" | "email" | "phone" | "select" | "radio" | "checkbox" | "scale" | "consent";

export type Question = {
  id: string; label: string; type: QuestionType; required: boolean;
  options?: string[]; other?: string; max?: number; min?: number;
  min_label?: string; max_label?: string; help?: string;
  prefill?: "contact_name" | "email" | "phone" | "company_name";
};
export type Section = { id: string; title: string; questions: Question[] };
export type Definition = {
  title: string; intro: string[]; safety_title: string; safety: string[]; required_note: string;
  thank_you: string[]; sections: Section[];
};
export type Answers = Record<string, string | string[]>;

const textLimit = (q: Question) => (q.type === "email" || q.type === "phone" ? 254 : q.max ?? 1000);
const OTHER_LIMIT = 200;

export const allQuestions = (def: Definition) => def.sections.flatMap((s) => s.questions);

function isAnswered(v: string | string[] | undefined) {
  return Array.isArray(v) ? v.length > 0 : !!v?.trim();
}

// Read a submitted form into answers, keeping only valid values.
// Returns problems as human-readable messages, keyed by question id.
export function readAnswers(def: Definition, fd: FormData) {
  const answers: Answers = {};
  const problems: Record<string, string> = {};

  for (const q of allQuestions(def)) {
    if (q.type === "checkbox") {
      const picked = fd.getAll(q.id).map(String).filter((v) => q.options!.includes(v));
      if (picked.length) answers[q.id] = [...new Set(picked)];
    } else if (q.type === "consent") {
      if (fd.get(q.id) === "yes") answers[q.id] = "yes";
    } else {
      const raw = String(fd.get(q.id) ?? "").trim();
      if (!raw) continue;
      if ((q.type === "select" || q.type === "radio") && !q.options!.includes(raw)) {
        problems[q.id] = "Choose one of the options";
      } else if (q.type === "scale" && !(/^\d+$/.test(raw) && +raw >= (q.min ?? 1) && +raw <= (q.max ?? 5))) {
        problems[q.id] = "Choose a value on the scale";
      } else if (q.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) {
        problems[q.id] = "Enter a valid email address";
      } else if (q.type === "phone" && raw.replace(/\D/g, "").length < 8) {
        problems[q.id] = "Enter a phone or WhatsApp number";
      } else if (["short_text", "long_text", "email", "phone"].includes(q.type) && raw.length > textLimit(q)) {
        problems[q.id] = `Keep this under ${textLimit(q)} characters`;
      } else {
        answers[q.id] = raw;
      }
    }

    // "Other (please specify)": keep the text only if "Other" is chosen.
    if (q.other) {
      const chosen = answers[q.id];
      const otherPicked = Array.isArray(chosen) ? chosen.includes(q.other) : chosen === q.other;
      const text = String(fd.get(`${q.id}:other`) ?? "").trim();
      if (otherPicked && text) {
        if (text.length > OTHER_LIMIT) problems[q.id] = `Keep "other" under ${OTHER_LIMIT} characters`;
        else answers[`${q.id}:other`] = text;
      }
    }
  }
  return { answers, problems };
}

// Required questions without an answer (for submit and the progress bar).
export function missingRequired(def: Definition, answers: Answers) {
  return allQuestions(def).filter((q) => q.required && !isAnswered(answers[q.id]));
}

export function progress(def: Definition, answers: Answers) {
  const all = allQuestions(def);
  return { answered: all.filter((q) => isAnswered(answers[q.id])).length, total: all.length };
}

// Turn a stored answer into readable text for the review screens.
export function answerText(q: Question, answers: Answers) {
  const v = answers[q.id];
  if (!isAnswered(v)) return null;
  if (q.type === "consent") return "Yes";
  const other = answers[`${q.id}:other`];
  const list = (Array.isArray(v) ? v : [v as string]).map((x) => (x === q.other && other ? `${x}: ${other}` : x));
  if (q.type === "scale") return `${v} of ${q.max ?? 5}`;
  return list.join(" · ");
}
