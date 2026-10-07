"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_50%,#ffffff_100%)] pt-16 pb-24 md:pt-24 md:pb-32">
      <div className="container-content relative z-10">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-display-sm font-semibold tracking-tight text-neutral-900 md:text-display lg:text-[3.25rem] lg:leading-[1.15]">
            Automate your work.
            <br />
            <span className="text-brand-600">Without the complexity.</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600 md:text-xl md:leading-relaxed">
            Connect your apps in minutes. Build powerful workflows with no code—so you can ship faster and focus on what matters.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push("/signup")}
            >
              Start for Free
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                const el = document.getElementById("how-it-works");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              See How It Works
            </Button>
          </div>
        </div>

        {/* Product mockup - floating card with glass effect */}
        <div className="mt-16 md:mt-20 flex justify-center">
          <div className="animate-float w-full max-w-3xl">
            <div className="rounded-2xl border border-neutral-200/80 bg-white/80 p-6 shadow-soft-lg backdrop-blur-sm md:p-8">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 md:p-6">
                <p className="mb-4 text-body-sm font-medium text-neutral-500">Automation flow</p>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
                  <div className="flex min-w-[200px] items-center gap-3 rounded-xl border-2 border-brand-200 bg-brand-50/50 px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-body font-semibold text-brand-700">1</span>
                    <div>
                      <p className="text-caption font-medium text-neutral-500">TRIGGER</p>
                      <p className="text-body font-medium text-neutral-900">Webhook</p>
                    </div>
                  </div>
                  <div className="hidden sm:block h-0 w-6 border-t-2 border-dashed border-neutral-300" />
                  <div className="flex min-w-[200px] items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-body font-semibold text-neutral-600">2</span>
                    <div>
                      <p className="text-caption font-medium text-neutral-500">ACTION</p>
                      <p className="text-body font-medium text-neutral-900">Send email</p>
                    </div>
                  </div>
                  <div className="hidden sm:block h-0 w-6 border-t-2 border-dashed border-neutral-300" />
                  <div className="flex min-w-[200px] items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-body font-semibold text-neutral-600">3</span>
                    <div>
                      <p className="text-caption font-medium text-neutral-500">ACTION</p>
                      <p className="text-body font-medium text-neutral-900">Notify</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-20 border-t border-neutral-200 pt-12">
          <p className="text-center text-body-sm font-medium text-neutral-500">
            Trusted by teams who ship fast
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {["10K+", "50+", "99.9%", "2 min"].map((stat, i) => (
              <div key={i} className="text-center">
                <span className="text-title text-neutral-900 font-semibold">{stat}</span>
                <span className="ml-1.5 text-body-sm text-neutral-500">
                  {i === 0 && "workflows run"}
                  {i === 1 && "integrations"}
                  {i === 2 && "uptime"}
                  {i === 3 && "to first automation"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
