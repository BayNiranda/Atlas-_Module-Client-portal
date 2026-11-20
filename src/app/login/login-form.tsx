"use client";

import { useActionState } from "react";
import { signIn } from "@/modules/auth/actions";
import { Button, ErrorMessage, Field } from "@/components/form";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <ErrorMessage message={state?.error} />
      <Button pending={pending}>Sign in</Button>
    </form>
  );
}
