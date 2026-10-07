import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      fontSize: {
        "display-lg": ["2.5rem", { lineHeight: "1.2", fontWeight: "600" }],
        "display": ["2rem", { lineHeight: "1.25", fontWeight: "600" }],
        "display-sm": ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
        "title": ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
        "title-sm": ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        "body": ["0.9375rem", { lineHeight: "1.5" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }],
        "caption": ["0.75rem", { lineHeight: "1.4" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "30": "7.5rem",
      },
      borderRadius: {
        "2xl": "0.75rem",
        "3xl": "0.875rem",
        "4xl": "1rem",
      },
      boxShadow: {
        "soft": "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "soft-md": "0 4px 6px -1px rgb(0 0 0 / 0.04), 0 2px 4px -2px rgb(0 0 0 / 0.04)",
        "soft-lg": "0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)",
        "border": "0 0 0 1px rgb(0 0 0 / 0.06)",
      },
      transitionDuration: {
        "fast": "150ms",
        "normal": "200ms",
      },
      maxWidth: {
        "content": "42rem",
        "content-lg": "56rem",
        "content-xl": "72rem",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
