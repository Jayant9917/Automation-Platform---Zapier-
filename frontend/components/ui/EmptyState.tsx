"use client";

import { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const defaultIcon = (
  <svg
    className="w-12 h-12 text-neutral-300"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
    />
  </svg>
);

export function EmptyState({
  icon = defaultIcon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 py-16 px-8 text-center ${className}`}
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-neutral-200 mb-6">
        {icon}
      </div>
      <h3 className="text-title-sm text-neutral-900 mb-2">{title}</h3>
      {description && (
        <p className="text-body text-neutral-500 max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
