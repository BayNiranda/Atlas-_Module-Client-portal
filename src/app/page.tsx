import Link from "next/link";

// Placeholder until the public website (Module 1).
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-24 text-center">
      <h1 className="mb-3 text-3xl font-semibold">Atlas Advisory</h1>
      <p className="mb-8 text-neutral-600">Our website is coming soon.</p>
      <Link href="/login" className="text-sm underline hover:no-underline">
        Client and staff sign in
      </Link>
    </main>
  );
}
