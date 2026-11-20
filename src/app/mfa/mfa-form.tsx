"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorMessage, Field } from "@/components/form";

type Setup = { factorId: string; qrCode?: string; secret?: string };

export function MfaForm() {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  // Use the existing verified factor, or start enrolling a new one.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setError(error.message);
      const verified = data.totp[0];
      if (verified) return setSetup({ factorId: verified.id });

      // Clear half-finished enrolments from earlier attempts.
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrolled.error) return setError(enrolled.error.message);
      setSetup({
        factorId: enrolled.data.id,
        qrCode: enrolled.data.totp.qr_code,
        secret: enrolled.data.totp.secret,
      });
    })();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!setup) return;
    setPending(true);
    setError(undefined);
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code });
    setPending(false);
    if (error) return setError("That code did not work. Check the time on your phone and try again.");
    await supabase.rpc("log_staff_sign_in"); // activity log; a failure here must not block sign-in
    router.replace("/admin");
    router.refresh();
  }

  if (!setup) return error ? <ErrorMessage message={error} /> : <p className="text-sm">Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {setup.qrCode && (
        <div className="space-y-2 text-sm">
          <p>Scan this QR code with your authenticator app:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from Supabase */}
          <img src={setup.qrCode} alt="Authenticator QR code" className="h-48 w-48 bg-white" />
          <p className="text-neutral-500">
            Or enter this key manually: <code className="break-all">{setup.secret}</code>
          </p>
        </div>
      )}
      <Field label="6-digit code" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required />
      <ErrorMessage message={error} />
      <Button pending={pending}>Verify</Button>
    </form>
  );
}
