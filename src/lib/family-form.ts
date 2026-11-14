import type { Gender, Relation } from "./types";

const RELATIONS: Relation[] = ["spouse", "son", "daughter", "father", "mother", "other"];
const GENDERS: Gender[] = ["male", "female", "other"];

export type MemberInput = { full_name: string; relation: Relation; birth_date: string | null; gender: Gender | null };

/** Reads and checks a family-member form (used by patients and doctors). */
export function parseMember(formData: FormData, { allowSelf = false } = {}): MemberInput | { error: string } {
  const full_name = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const relation = String(formData.get("relation") ?? "") as Relation;
  const birth = String(formData.get("birth_date") ?? "").trim();
  const gender = String(formData.get("gender") ?? "") as Gender | "";

  if (full_name.length < 2 || full_name.length > 120) return { error: "Enter the person's full name." };
  if (!RELATIONS.includes(relation) && !(allowSelf && relation === "self")) return { error: "Choose how they're related." };
  if (birth) {
    const d = new Date(`${birth}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || Number.isNaN(d.getTime()) || birth < "1900-01-01") return { error: "Check the date of birth." };
    if (d.getTime() > Date.now()) return { error: "Date of birth can't be in the future." };
  }
  if (gender && !GENDERS.includes(gender)) return { error: "Choose a gender." };
  return { full_name, relation, birth_date: birth || null, gender: gender || null };
}
