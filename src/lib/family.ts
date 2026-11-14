import type { FamilyMember, Gender, Relation } from "./types";

export const relations: { value: Relation; label: string }[] = [
  { value: "spouse", label: "Spouse" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "other", label: "Other" },
];

export const relationLabel: Record<Relation, string> = {
  self: "Self",
  spouse: "Spouse",
  son: "Son",
  daughter: "Daughter",
  father: "Father",
  mother: "Mother",
  other: "Other",
};

export const genderLabel: Record<Gender, string> = { male: "Male", female: "Female", other: "Other" };

/** Age on a given day: months under 2 years (matters for children's doses), years after. */
export function ageText(birthDate: string | null, on: Date = new Date()) {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  let months = (on.getFullYear() - b.getFullYear()) * 12 + (on.getMonth() - b.getMonth());
  if (on.getDate() < b.getDate()) months--;
  if (months < 0) return null;
  return months < 24 ? `${months} mo` : `${Math.floor(months / 12)} y`;
}

/** "Son · 8 y · Male" */
export function memberDetails(m: Pick<FamilyMember, "relation" | "birth_date" | "gender">, on?: Date) {
  return [relationLabel[m.relation], ageText(m.birth_date, on), m.gender && genderLabel[m.gender]].filter(Boolean).join(" · ");
}

/** Doctors often type "Dr" in their own name; the site adds "Dr." itself. */
export const drName = (name: string | null) => (name ? name.replace(/^\s*dr\.?\s+/i, "") : null);
