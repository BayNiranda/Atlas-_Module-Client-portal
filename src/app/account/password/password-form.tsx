"use client";

import { useActionState } from "react";
import { setPassword } from "@/modules/auth/actions";
import { Button, ErrorMessage, Field } from "@/components/form";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="New password (12+ characters)" name="password" type="password" autoComplete="new-password" required minLength={12} />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
      <ErrorMessage message={state?.error} />
      <Button pending={pending}>Save password</Button>
    </form>
  );
}
