import Link from "next/link";
import { connection } from "next/server";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/auth";
import { signOut } from "../(auth)/login/actions";
import { PortalNav } from "./PortalNav";

export default async function PortalLayout({ children }: LayoutProps<"/app">) {
  await connection(); // always render per request — this area is private
  if (!isSupabaseConfigured) {
    return (
      <main className="container-page max-w-lg py-24">
        <SetupNotice />
      </main>
    );
  }
  const { profile } = await requireViewer();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <header className="border-b border-line bg-white">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/app" aria-label="Dashboard"><Logo /></Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{profile.full_name ?? profile.phone}</p>
              <p className="text-xs capitalize text-muted">{profile.role}</p>
            </div>
            <form action={signOut}>
              <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-brand-50 hover:text-ink">
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
        <PortalNav role={profile.role} />
      </header>
      <main className="container-page flex-1 py-10">{children}</main>
    </div>
  );
}
