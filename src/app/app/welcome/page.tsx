import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { Card } from "../ui";
import { NameForm } from "./NameForm";

export default async function WelcomePage() {
  const { profile } = await requireViewer();
  if (profile.full_name) redirect("/app");
  return (
    <div className="mx-auto max-w-md">
      <Card className="p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Welcome to Farmacia Tech</h1>
        <p className="mt-2 text-sm text-muted">What should we call you? Doctors will see this name on your prescriptions.</p>
        <div className="mt-6"><NameForm /></div>
      </Card>
    </div>
  );
}
