"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * A submit button for forms that post straight to a server action. While the form is working it shows a
 * spinner on the button that was clicked and disables the form's buttons, so a click always visibly does something.
 */
export function SubmitButton({ children, className = "", disabled, ...props }: ComponentProps<"button">) {
  const { pending, data } = useFormStatus();
  // With several buttons in one form (e.g. Approve / Reject), spin only the one that was pressed.
  const pressed = pending && (!props.name || data?.get(props.name) === String(props.value ?? ""));
  return (
    <button
      type="submit"
      {...props}
      disabled={disabled || pending}
      aria-busy={pressed || undefined}
      className={`inline-flex items-center justify-center gap-1.5 transition active:scale-[0.97] disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pressed && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
