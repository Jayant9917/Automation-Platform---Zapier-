"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  children,
  className = "",
  padding = "md",
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white shadow-soft transition-shadow duration-fast hover:shadow-soft-md ${paddingMap[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-title text-neutral-900">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-body-sm text-neutral-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
