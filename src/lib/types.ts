export type Role = "patient" | "doctor" | "vendor" | "admin";

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
};
