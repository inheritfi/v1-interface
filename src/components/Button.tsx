import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "heir" | "contact" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Cyan (primary) for owner actions, magenta (heir) for inheritance actions, sky (contact) for recovery. */
export function Button({ variant = "ghost", className, type = "button", ...rest }: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`, className].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...rest} />;
}
