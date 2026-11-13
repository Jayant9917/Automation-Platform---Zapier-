// Docker serves browser traffic through the same reverse proxy origin.
// Empty defaults intentionally produce relative /api and /hooks URLs.
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/$/, "") ?? "";
export const HOOKS_URL = process.env.NEXT_PUBLIC_HOOKS_URL?.trim().replace(/\/$/, "") ?? "";
