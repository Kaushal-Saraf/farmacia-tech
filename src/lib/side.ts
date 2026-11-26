/**
 * Which side of the portal someone is using right now. A number can hold several roles
 * (patient, doctor, operator, admin); the sign-in door picks the side, and the portal shows
 * only that side. Stored in a cookie; the role itself is always checked on the server.
 */
export type Side = "patient" | "doctor" | "vendor" | "admin";

export const SIDE_COOKIE = "ft_side";
export const SIDE_COOKIE_OPTIONS = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180 };

export const isSide = (v: unknown): v is Side => v === "patient" || v === "doctor" || v === "vendor" || v === "admin";

export const sideLabel: Record<Side, string> = {
  patient: "Patient",
  doctor: "Doctor",
  vendor: "Machine operator",
  admin: "Admin",
};

export const sideHome: Record<Side, string> = {
  patient: "/app/patient",
  doctor: "/app/doctor",
  vendor: "/app/vendor",
  admin: "/app/admin",
};
