"use client";

import { useEffect, useRef, useState } from "react";

type ToastKind = "message" | "success" | "warning" | "error";
type Toast = { id: number; text: string; type: ToastKind };
const eventName = "actionhub:toast";
let nextId = 0;
function show(text: string, type: ToastKind) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(eventName, { detail: { id: ++nextId, text, type } }));
}
export const toast = {
  message: (text: string) => show(text, "message"),
  success: (text: string) => show(text, "success"),
  warning: (text: string) => show(text, "warning"),
  error: (text: string) => show(text, "error"),
};
export function useToasts() {
  return toast;
}

// Keep inline feedback available while also making it visible above an open panel.
export function useToastFeedback(error: string, message = "") {
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);
  useEffect(() => {
    if (message) toast.success(message);
  }, [message]);
}

function ToastCard({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const remaining = useRef(toast.type === "error" ? 12000 : 6000);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  function pause() {
    if (timer.current === undefined) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
  }
  function resume() {
    if (timer.current !== undefined) return;
    started.current = Date.now();
    timer.current = setTimeout(() => dismiss(toast.id), remaining.current);
  }
  useEffect(() => {
    resume();
    return pause;
    // Each card owns one timer; hover and keyboard focus pause its countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const colors = {
    message: "border-brand-100 bg-white text-neutral-800",
    success: "border-green-200 bg-green-50 text-green-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 text-sm shadow-lg ${colors[toast.type]}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resume();
      }}
    >
      <div className="min-w-0 flex-1 whitespace-pre-line break-words">
        <p className="mb-1 font-semibold">
          {
            {
              message: "Notice",
              success: "Success",
              warning: "Please check",
              error: "Something needs attention",
            }[toast.type]
          }
        </p>
        {toast.text}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className="rounded-md px-2 py-1 text-lg leading-none hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    function receive(event: Event) {
      const toast = (event as CustomEvent<Toast>).detail;
      setToasts((current) =>
        [...current.filter((item) => item.text !== toast.text), toast].slice(-3),
      );
    }
    window.addEventListener(eventName, receive);
    return () => window.removeEventListener(eventName, receive);
  }, []);
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-[420px] max-w-[calc(100vw-2rem)] flex-col gap-3"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          dismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))}
        />
      ))}
    </section>
  );
}
