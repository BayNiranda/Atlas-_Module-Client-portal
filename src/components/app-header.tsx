import { signOut } from "@/modules/auth/actions";

export function AppHeader({ area, name, role }: { area: string; name: string; role: string }) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
      <div className="text-sm">
        <span className="font-semibold">Atlas Advisory</span>
        <span className="ml-2 text-neutral-500">{area}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span>
          {name} <span className="text-neutral-500">· {role}</span>
        </span>
        <form action={signOut}>
          <button type="submit" className="underline hover:no-underline">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
