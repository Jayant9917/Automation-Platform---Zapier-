"use client";

import { useRouter } from "next/navigation";
import { FadeInSection } from "./FadeInSection";
import { Button } from "@/components/ui/Button";

export function PricingPreviewSection() {
  const router = useRouter();

  return (
    <FadeInSection>
      <section className="section-padding bg-neutral-50/50">
        <div className="container-content text-center">
          <h2 className="section-heading">Simple, transparent pricing</h2>
          <p className="section-subtext">
            Start free. Scale when you’re ready. No surprise fees.
          </p>
          <div className="mt-16 flex justify-center">
            <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-10 shadow-soft">
              <p className="text-title text-neutral-900 font-semibold">Free</p>
              <p className="mt-2 text-display-sm font-semibold text-neutral-900">$0</p>
              <p className="mt-1 text-body-sm text-neutral-500">forever for core features</p>
              <ul className="mt-8 space-y-4 text-left text-body text-neutral-600">
                <li className="flex items-center gap-3">
                  <span className="h-5 w-5 rounded-full bg-brand-100 flex items-center justify-center">
                    <svg className="h-3 w-3 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  Unlimited workflows
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-5 w-5 rounded-full bg-brand-100 flex items-center justify-center">
                    <svg className="h-3 w-3 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  Core integrations
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-5 w-5 rounded-full bg-brand-100 flex items-center justify-center">
                    <svg className="h-3 w-3 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  Community support
                </li>
              </ul>
              <Button
                variant="primary"
                size="lg"
                className="mt-8 w-full"
                onClick={() => router.push("/signup")}
              >
                Get started free
              </Button>
            </div>
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
