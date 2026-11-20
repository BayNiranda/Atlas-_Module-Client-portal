"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, staffForAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/modules/inquiries/admin-schema";
import { missingRequired, readAnswers, type Definition } from "./answers";
import { getAssessment } from "./queries";

export type AssessmentResult = ActionResult & { missing?: { id: string; label: string }[]; problems?: Record<string, string> };

const ERRORS: Record<string, string> = {
  not_allowed: "You do not have permission to do this.",
  not_editable: "This pre-assessment has been submitted and can no longer be changed.",
  invalid_answers: "Some answers could not be saved. Please check them and try again.",
  not_submitted: "Only a submitted pre-assessment can be reviewed.",
  comment_required: "Explain what needs to change, so the client knows what to do.",
};
const explain = (m: string) => Object.entries(ERRORS).find(([k]) => m.includes(k))?.[1] ?? "Could not save. Please try again.";

// Client saves (draft) or submits. The server reads answers strictly against the
// questionnaire version the assessment is pinned to; the database checks again.
export async function saveAssessment(_: AssessmentResult, fd: FormData): Promise<AssessmentResult> {
  const user = await getCurrentUser();
  if (!user || user.staffRole) return { error: ERRORS.not_allowed };
  const id = z.uuid().safeParse(fd.get("assessment_id"));
  if (!id.success) return { error: ERRORS.not_allowed };
  const assessment = await getAssessment(id.data);
  if (!assessment?.version) return { error: ERRORS.not_allowed };

  const def = assessment.version.definition as Definition;
  const { answers, problems } = readAnswers(def, fd);
  if (Object.keys(problems).length) return { error: "Please correct the highlighted answers.", problems };

  const submitting = fd.get("intent") === "submit";
  if (submitting) {
    const missing = missingRequired(def, answers);
    if (missing.length) {
      // Save what they have, then tell them what's missing.
      const supabase = await createClient();
      await supabase.rpc("save_assessment", { p_id: assessment.id, p_answers: answers });
      refresh();
      return { error: `${missing.length} required question${missing.length > 1 ? "s are" : " is"} still unanswered. Your answers so far are saved.`, missing: missing.map((q) => ({ id: q.id, label: q.label })) };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(submitting ? "submit_assessment" : "save_assessment", { p_id: assessment.id, p_answers: answers });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: submitting ? "Submitted." : "Saved. You can come back and finish later." };
}

// Staff approve, or ask for changes with a comment the client will see.
const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approve", "changes"]),
  comment: z.string().trim().max(2000).optional(),
});

export async function reviewAssessment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const parsed = reviewSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_assessment", {
    p_id: parsed.data.id, p_approve: parsed.data.decision === "approve", p_comment: parsed.data.comment ?? null,
  });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: parsed.data.decision === "approve" ? "Approved. The client has been notified." : "Sent back to the client with your comment." };
}
