import { Server, Stethoscope, User, type LucideIcon } from "lucide-react";

/** The three ways in. Each has its own sign-in page at /login/<role>. */
export const loginRoles = {
  patient: {
    label: "Patient",
    title: "Patient sign in",
    icon: User,
    pitch: "See prescriptions from your doctor and collect medicines from a nearby machine.",
    intro: "Sign in with the mobile number your doctor has. Your prescriptions appear as soon as you're in.",
  },
  doctor: {
    label: "Doctor",
    title: "Doctor sign in",
    icon: Stethoscope,
    pitch: "Write digital prescriptions your patients can collect 24×7.",
    intro: "New here? Sign in with your mobile number, then submit your medical registration. Prescribing unlocks once we verify it.",
  },
  vendor: {
    label: "Machine operator",
    title: "Operator sign in",
    icon: Server,
    pitch: "Manage stock, expiry dates and scans on your vending machines and Medicine Checkers.",
    intro: "Sign in with your mobile number, then link your device with the Device ID and pairing code from Farmacia Tech.",
  },
} satisfies Record<string, { label: string; title: string; icon: LucideIcon; pitch: string; intro: string }>;

export type LoginRole = keyof typeof loginRoles;

export function isLoginRole(v: unknown): v is LoginRole {
  return typeof v === "string" && Object.hasOwn(loginRoles, v);
}

/** Where to go after the code is verified: a specific deep link if we have one, else that door's home. */
export function landingFor(role: LoginRole, next: string) {
  return next !== "/app" ? next : `/app?as=${role}`;
}
