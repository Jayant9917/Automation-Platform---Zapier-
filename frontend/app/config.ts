// Backend API (Express). Default 3000 – Next.js usually runs on 3001. Set NEXT_PUBLIC_BACKEND_URL if different.
export const BACKEND_URL =
  typeof process.env.NEXT_PUBLIC_BACKEND_URL === "string" && process.env.NEXT_PUBLIC_BACKEND_URL.trim()
    ? process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")
    : "http://localhost:3000";

export const HOOKS_URL =
  typeof process.env.NEXT_PUBLIC_HOOKS_URL === "string" && process.env.NEXT_PUBLIC_HOOKS_URL.trim()
    ? process.env.NEXT_PUBLIC_HOOKS_URL.replace(/\/$/, "")
    : "http://localhost:3002";