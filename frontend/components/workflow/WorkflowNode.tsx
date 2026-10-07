"use client";

interface WorkflowNodeProps {
  index: number;
  label: string;
  type: "trigger" | "action";
  onClick: () => void;
}

export function WorkflowNode({ index, label, type, onClick }: WorkflowNodeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex min-w-[280px] max-w-[320px] items-center gap-4 rounded-2xl border-2 bg-white px-5 py-4
        text-left transition-all duration-fast
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
        ${type === "trigger"
          ? "border-brand-200 bg-brand-50/30 hover:border-brand-300 hover:bg-brand-50/50"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-soft"}
      `}
    >
      <span
        className={`
          flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-body font-semibold
          ${type === "trigger"
            ? "bg-brand-100 text-brand-700"
            : "bg-neutral-100 text-neutral-600"}
        `}
      >
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">
          {type}
        </p>
        <p className="truncate text-body font-medium text-neutral-900">{label}</p>
      </div>
      <svg
        className="h-5 w-5 shrink-0 text-neutral-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  );
}
