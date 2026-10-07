"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { Button } from "@/components/ui/Button";

export function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string | null; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || !token.trim()) {
      setAuthChecked(true);
      return;
    }
    axios
      .get(`${BACKEND_URL}/api/v1/user`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data?.user) setUser(res.data.user);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header
        className={`sticky top-0 z-50 border-b transition-all duration-200 ${
          scrolled ? "border-neutral-200 bg-white/90 shadow-soft backdrop-blur-md" : "border-transparent bg-transparent"
        }`}
      >
        <div className="container-content flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-title font-semibold text-neutral-900 transition-opacity duration-fast hover:opacity-80"
          >
            Automate
          </Link>
          <nav className="flex items-center gap-2">
            {authChecked &&
              (user ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/dashboard")}
                  >
                    Dashboard
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem("token");
                      router.push("/");
                      window.location.reload();
                    }}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/login")}
                  >
                    Log in
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push("/signup")}
                  >
                    Sign up
                  </Button>
                </>
              ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
