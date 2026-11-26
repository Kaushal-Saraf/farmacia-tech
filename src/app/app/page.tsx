import { redirect } from "next/navigation";
import { getSide, requireViewer } from "@/lib/auth";
import { sideHome } from "@/lib/side";

/** Sends everyone to the home of the side they signed in through (or last switched to). */
export default async function PortalHome() {
  const { profile } = await requireViewer();
  const side = await getSide();
  if (side === "patient" && !profile.full_name) redirect("/app/welcome");
  redirect(sideHome[side]);
}
