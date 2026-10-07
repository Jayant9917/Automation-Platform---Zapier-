"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface TopNavProps {
  user: { name: string | null; email: string } | null;
  onLogout: () => void;
  onMenuClick?: () => void;
}

export function TopNav({ user, onLogout, onMenuClick }: TopNavProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 lg:px-6">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <div className="relative flex-1 max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 py-2 pl-9 pr-4 text-body placeholder:text-neutral-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            aria-label="Search"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-body hover:bg-neutral-100 transition-colors duration-fast"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <span className="hidden sm:inline text-neutral-700 font-medium">
                {user.name || user.email}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700 text-body-sm font-medium">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              <svg
                className={`h-4 w-4 text-neutral-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {profileOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-neutral-200 bg-white py-2 shadow-soft-lg"
                role="menu"
              >
                <div className="border-b border-neutral-100 px-4 py-3">
                  <p className="text-body font-medium text-neutral-900 truncate">
                    {user.name || "User"}
                  </p>
                  <p className="text-body-sm text-neutral-500 truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                  className="w-full px-4 py-2 text-left text-body text-neutral-700 hover:bg-neutral-50"
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
              Log in
            </Button>
            <Button variant="primary" size="sm" onClick={() => router.push("/signup")}>
              Sign up
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
