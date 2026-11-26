import type { Metadata } from "next";
import { UserPlus, UserRound } from "lucide-react";
import { requireSide } from "@/lib/auth";
import { memberDetails } from "@/lib/family";
import type { FamilyMember } from "@/lib/types";
import { removeMember } from "../actions";
import { Card, PageTitle } from "../../ui";
import { MemberForm } from "./MemberForm";

export const metadata: Metadata = { title: "My family" };

type Member = FamilyMember & { added_by_name: string | null };

export default async function FamilyPage() {
  const { supabase, profile } = await requireSide("patient");
  const { data } = await supabase
    .from("family_members")
    .select("id, full_name, relation, birth_date, gender, added_by_name")
    .eq("account_id", profile.id)
    .eq("is_archived", false)
    .order("created_at")
    .returns<Member[]>();
  // Account holder first.
  const members = (data ?? []).sort((a, b) => Number(b.relation === "self") - Number(a.relation === "self"));

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="My family"
        subtitle={`Everyone who uses ${profile.phone ?? "this number"}. Doctors choose the right person when they prescribe.`}
      />

      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.id}>
            <Card className="p-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink">{m.full_name}</span>
                    <span className="block text-xs text-muted">
                      {memberDetails(m)}
                      {m.added_by_name && ` · added by ${m.added_by_name}`}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-brand-600 group-open:hidden">Edit</span>
                  <span className="hidden text-sm font-semibold text-muted group-open:inline">Close</span>
                </summary>
                <div className="border-t border-line px-6 py-5">
                  <MemberForm member={m} />
                  {m.relation !== "self" && (
                    <form action={removeMember} className="mt-4 border-t border-line pt-4">
                      <input type="hidden" name="id" value={m.id} />
                      <button className="text-sm font-semibold text-red-600 hover:underline">Remove {m.full_name.split(" ")[0]} from my family</button>
                      <p className="mt-1 text-xs text-muted">Their past prescriptions stay in your account.</p>
                    </form>
                  )}
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-8">
        <h2 className="mb-5 flex items-center gap-2 font-bold text-ink"><UserPlus className="h-5 w-5 text-brand-500" /> Add a family member</h2>
        <MemberForm />
      </Card>
    </div>
  );
}
