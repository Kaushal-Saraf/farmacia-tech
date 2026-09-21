import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "white";

const styles: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/30",
  secondary: "bg-white text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50",
  white: "bg-white text-brand-800 hover:bg-brand-50",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}
