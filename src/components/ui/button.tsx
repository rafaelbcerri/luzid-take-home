import type { ButtonHTMLAttributes } from "react";

import { classNames } from "@/components/ui/class-names";
import { Spinner } from "@/components/ui/spinner";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 disabled:bg-accent-500/50",
  secondary:
    "border border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50",
  ghost: "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
  danger:
    "border border-transparent text-danger-600 hover:bg-danger-50 hover:border-danger-600/20",
};

const SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  className,
  children,
  disabled,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      {...buttonProps}
      disabled={disabled || isLoading}
      className={classNames(
        "inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASS_NAMES[variant],
        SIZE_CLASS_NAMES[size],
        className,
      )}
    >
      {isLoading ? <Spinner className="size-3.5" /> : null}
      {children}
    </button>
  );
}
