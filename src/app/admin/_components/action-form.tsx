"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/modules/inquiries/admin-schema";

type Props = {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  // Optional custom view once the action succeeds (e.g. the invitation link).
  done?: (result: ActionResult) => React.ReactNode;
};

// A form that calls a server action and shows its error or success message.
export function ActionForm({ action, children, submit, className, done }: Props) {
  const [state, run, pending] = useActionState(action, {});
  if (state.ok && done) return <>{done(state)}</>;
  return (
    <form action={run} className={className} noValidate>
      {children}
      <div className="actions">
        <button className="btn btn-p" type="submit" disabled={pending}>{pending ? "Saving…" : submit}</button>
      </div>
      {state.error && <div className="msg err" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="msg ok" role="status">{state.message}</div>}
    </form>
  );
}
