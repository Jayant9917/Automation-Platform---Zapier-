"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string | null; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || !token.trim()) {
      setAuthChecked(true);
      router.push("/login");
      return;
    }
    axios
      .get(`${BACKEND_URL}/api/v1/user`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data?.user) setUser(res.data.user);
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          localStorage.removeItem("token");
          router.push("/login");
        }
      })
      .finally(() => setAuthChecked(true));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/");
  };

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar
        mobileOpen={sidebarMobileOpen}
        onMobileOpenChange={setSidebarMobileOpen}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <TopNav
          user={user}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
