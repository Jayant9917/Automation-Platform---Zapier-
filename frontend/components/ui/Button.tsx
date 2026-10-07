"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const sizeStyles = {
  sm: "text-body-sm px-3 py-1.5 gap-1.5",
  md: "text-body px-4 py-2 gap-2",
  lg: "text-title-sm px-6 py-3 gap-2",
};

const variantStyles = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-soft hover:shadow-soft-md",
  secondary:
    "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 active:bg-neutral-100",
  ghost:
    "text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghostDanger:
    "text-red-600 hover:bg-red-50 active:bg-red-100",
};

type Variant = keyof typeof variantStyles;
type Size = keyof typeof sizeStyles;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${base} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  size = "md",
  className = "",
  disabled,
  type,
}: {
  children: ReactNode;
  onClick?: () => void;
  size?: Size;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <Button
      variant="primary"
      size={size}
      onClick={onClick}
      className={className}
      disabled={disabled}
      type={type ?? "button"}
    >
      {children}
    </Button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  size = "md",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  size?: Size;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="secondary"
      size={size}
      onClick={onClick}
      className={className}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

export function GhostButton({
  children,
  onClick,
  size = "md",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  size?: Size;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size={size}
      onClick={onClick}
      className={className}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

export function DangerButton({
  children,
  onClick,
  size = "md",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  size?: Size;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="danger"
      size={size}
      onClick={onClick}
      className={className}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
