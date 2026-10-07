"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="block text-body-sm font-medium text-neutral-700 mb-1.5"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-xl border bg-white px-4 py-2.5 text-body
            placeholder:text-neutral-400
            transition-colors duration-fast
            focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500
            disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed
            ${error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-neutral-200 hover:border-neutral-300"}
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-body-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-caption text-neutral-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
