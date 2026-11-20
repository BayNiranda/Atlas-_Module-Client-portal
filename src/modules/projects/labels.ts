export const PROJECT_STATUS = [
  ["onboarding", "Onboarding"], ["in_delivery", "In delivery"], ["on_hold", "On hold"],
  ["completed", "Completed"], ["cancelled", "Cancelled"],
] as const;
export const projectStatusLabel = (s: string) => PROJECT_STATUS.find(([k]) => k === s)?.[1] ?? s;
export const projectTone = (s: string) =>
  s === "in_delivery" ? "gold" : s === "completed" ? "green" : s === "on_hold" ? "red" : "grey";

export const TASK_STATUS = [["todo", "To do"], ["in_progress", "In progress"], ["blocked", "Blocked"], ["done", "Done"]] as const;
export const taskStatusLabel = (s: string) => TASK_STATUS.find(([k]) => k === s)?.[1] ?? s;
export const taskTone = (s: string) => (s === "done" ? "green" : s === "blocked" ? "red" : s === "in_progress" ? "gold" : "grey");

export const REQUEST_STATUS = [["open", "Open"], ["in_review", "In review"], ["resolved", "Resolved"], ["closed", "Closed"]] as const;
export const requestStatusLabel = (s: string) => REQUEST_STATUS.find(([k]) => k === s)?.[1] ?? s;
export const requestTone = (s: string) => (s === "open" ? "red" : s === "in_review" ? "gold" : s === "resolved" ? "green" : "grey");

// Progress = share of done tasks (whatever the viewer can see).
export const progress = (tasks: { status: string }[]) =>
  tasks.length ? Math.round((100 * tasks.filter((t) => t.status === "done").length) / tasks.length) : 0;
