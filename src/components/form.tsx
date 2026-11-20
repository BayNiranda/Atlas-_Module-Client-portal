import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        {...input}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
      />
    </label>
  );
}

export function Button({ pending, children }: { pending?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}
