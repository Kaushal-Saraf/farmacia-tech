import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeftRight, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { availableSides, getSide, hasRole, isDoctorApplicant, requireViewer } from "@/lib/auth";
import { sideLabel } from "@/lib/side";
import { signOut } from "../(auth)/login/actions";
import { switchSide } from "./actions";
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
  const [side, sides, doctorApplicant] = await Promise.all([getSide(), availableSides(), isDoctorApplicant()]);
  const isDoctor = hasRole(profile, "doctor");
  const isVendor = hasRole(profile, "vendor");
  const label =
    side === "doctor" && !isDoctor ? (doctorApplicant ? "Doctor · awaiting verification" : "Doctor sign-up")
    : side === "vendor" && !isVendor ? "Machine operator · no device yet"
    : sideLabel[side];
  const others = sides.filter((s) => s !== side);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <header className="border-b border-line bg-white">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/app" aria-label="Dashboard"><Logo /></Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{profile.full_name ?? profile.phone}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
            {others.length > 0 && (
              <form action={switchSide} className="flex items-center gap-1">
                <ArrowLeftRight className="hidden h-4 w-4 text-muted sm:block" aria-hidden />
                {others.map((s) => (
                  <button
                    key={s}
                    name="side"
                    value={s}
                    className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50"
                  >
                    {sideLabel[s]}
                  </button>
                ))}
              </form>
            )}
            <form action={signOut}>
              <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-brand-50 hover:text-ink">
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
        <PortalNav side={side} isDoctor={isDoctor} isVendor={isVendor} />
      </header>
      <main className="container-page flex-1 py-10">{children}</main>
    </div>
  );
}
