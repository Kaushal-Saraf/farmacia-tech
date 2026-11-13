import { redirect } from "next/navigation";
import { isDoctorApplicant, requireViewer } from "@/lib/auth";

const home = { patient: "/app/patient", doctor: "/app/doctor", vendor: "/app/vendor", admin: "/app/admin" } as const;

/** Sends everyone to their own area. `?as=` is the door they chose on the sign-in page. */
export default async function PortalHome({ searchParams }: PageProps<"/app">) {
  const { profile } = await requireViewer();
  const { as } = await searchParams;

  if (profile.role === "patient") {
    // Came in through the operator door but no machines are linked yet → explain what to do.
    if (as === "vendor") redirect("/app/vendor");
    // New doctors go straight to verification, and stay there until approved.
    if (as === "doctor" || (await isDoctorApplicant())) redirect("/app/doctor");
  }

  if (!profile.full_name) redirect("/app/welcome");
  redirect(home[profile.role]);
}
