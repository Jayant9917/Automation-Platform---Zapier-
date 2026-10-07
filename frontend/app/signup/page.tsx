"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckFeature } from "@/components/CheckFeature";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/v1/user/signup`, {
        username: email,
        password,
        name,
      });
      router.push("/login");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : null;
      setError(message || "Sign up failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <MarketingLayout>
      <div className="container-content flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="grid w-full max-w-5xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col justify-center">
            <h1 className="text-display-sm text-neutral-900">
              Join millions worldwide who automate their work.
            </h1>
            <ul className="mt-8 space-y-6">
              <li>
                <CheckFeature label="Easy setup, no coding required" />
              </li>
              <li>
                <CheckFeature label="Free forever for core features" />
              </li>
              <li>
                <CheckFeature label="14-day trial of premium features & apps" />
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-soft">
            <h2 className="text-title text-neutral-900">Create your account</h2>
            <p className="mt-1 text-body-sm text-neutral-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Log in
              </Link>
            </p>
            <form
              className="mt-8 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <Input
                label="Name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              {error && (
                <p className="text-body-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? "Creating account…" : "Get started free"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
