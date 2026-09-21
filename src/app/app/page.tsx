import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";

export default async function PortalHome() {
  const { profile } = await requireViewer();
  if (!profile.full_name) redirect("/app/welcome");
  const home = { patient: "/app/patient", doctor: "/app/doctor", vendor: "/app/vendor", admin: "/app/admin" } as const;
  redirect(home[profile.role]);
}
