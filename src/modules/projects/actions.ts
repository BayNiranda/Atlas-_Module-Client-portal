"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, MANAGERS, staffForAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { firstError, type ActionResult } from "@/modules/inquiries/admin-schema";
import { PROJECT_STATUS, REQUEST_STATUS, TASK_STATUS } from "./labels";

const ERRORS: Record<string, string> = {
  not_allowed: "You do not have permission to do this.",
  not_staff: "Only active Atlas staff can be on a project.",
  assignee_not_staff: "Tasks can only be assigned to Atlas staff.",
  not_found: "Not found.",
};
const explain = (m: string) => Object.entries(ERRORS).find(([k]) => m.includes(k))?.[1] ?? "Could not save. Please try again.";
const keys = <T extends readonly (readonly [string, string])[]>(list: T) => list.map(([k]) => k) as [T[number][0], ...T[number][0][]];

// ---------- Project stage and team (coordinator and above) ----------

const statusSchema = z.object({ id: z.uuid(), status: z.enum(keys(PROJECT_STATUS)) });

export async function setProjectStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(MANAGERS))) return { error: ERRORS.not_allowed };
  const parsed = statusSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please choose a stage." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_project_status", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: "Stage updated. The client has been notified." };
}

const teamSchema = z.object({
  id: z.uuid(),
  coordinator: z.union([z.uuid(), z.literal("")]),
  staff: z.array(z.uuid()).max(50),
});

export async function setProjectTeam(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(MANAGERS))) return { error: ERRORS.not_allowed };
  const parsed = teamSchema.safeParse({ id: fd.get("id"), coordinator: fd.get("coordinator") ?? "", staff: fd.getAll("staff") });
  if (!parsed.success) return { error: "Please check the team." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_project_team", { p_id: d.id, p_coordinator: d.coordinator || null, p_staff: d.staff });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: "Team saved." };
}

// ---------- Tasks (managers, or staff on the project; RLS decides) ----------

const taskSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  project_id: z.uuid(),
  title: z.string().trim().min(1, "Give the task a title").max(200),
  description: z.string().trim().max(2000),
  status: z.enum(keys(TASK_STATUS)),
  assignee_id: z.union([z.uuid(), z.literal("")]),
  due_date: z.union([z.iso.date(), z.literal("")]),
  client_visible: z.boolean(),
});

export async function saveTask(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const parsed = taskSchema.safeParse({
    ...Object.fromEntries(["id", "project_id", "title", "description", "status", "assignee_id", "due_date"].map((k) => [k, fd.get(k) ?? ""])),
    client_visible: fd.get("client_visible") === "on",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id, project_id, ...d } = parsed.data;
  const row = { ...d, description: d.description || null, assignee_id: d.assignee_id || null, due_date: d.due_date || null };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("tasks").update(row).eq("id", id).eq("project_id", project_id).select("id")
    : await supabase.from("tasks").insert({ ...row, project_id }).select("id");
  if (error) return { error: error.code === "42501" ? ERRORS.not_allowed : explain(error.message) };
  if (!data?.length) return { error: ERRORS.not_allowed }; // RLS hid the row: not on this project
  refresh();
  return { ok: true, message: id ? "Task saved." : "Task added." };
}

const taskStatusSchema = z.object({ id: z.uuid(), status: z.enum(keys(TASK_STATUS)) });

export async function setTaskStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const parsed = taskStatusSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please choose a status." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update({ status: parsed.data.status }).eq("id", parsed.data.id).select("id");
  if (error || !data?.length) return { error: ERRORS.not_allowed };
  refresh();
  return { ok: true };
}

export async function deleteTask(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return { error: ERRORS.not_found };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", id.data).select("id");
  if (error || !data?.length) return { error: ERRORS.not_allowed };
  refresh();
  return { ok: true };
}

// ---------- Service requests ----------

const raiseSchema = z.object({
  org_id: z.uuid(),
  project_id: z.union([z.uuid(), z.literal("")]),
  subject: z.string().trim().min(1, "Add a short subject").max(200),
  description: z.string().trim().min(1, "Tell us what you need").max(4000),
});

export async function raiseServiceRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.staffRole) return { error: ERRORS.not_allowed };
  const parsed = raiseSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("raise_service_request", {
    p_org: d.org_id, p_project: d.project_id || null, p_subject: d.subject, p_description: d.description,
  });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: "Sent. Atlas has been notified and will reply here." };
}

const answerSchema = z.object({ id: z.uuid(), status: z.enum(keys(REQUEST_STATUS)), reply: z.string().trim().max(4000) });

export async function answerServiceRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(MANAGERS))) return { error: ERRORS.not_allowed };
  const parsed = answerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_service_request", { p_id: parsed.data.id, p_status: parsed.data.status, p_reply: parsed.data.reply });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: "Saved. The client has been notified." };
}
