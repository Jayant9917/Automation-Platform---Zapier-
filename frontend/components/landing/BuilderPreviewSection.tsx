"use client";

import { useRouter } from "next/navigation";
import { FadeInSection } from "./FadeInSection";
import { Button } from "@/components/ui/Button";

export function BuilderPreviewSection() {
  const router = useRouter();

  return (
    <FadeInSection>
      <section className="section-padding bg-white">
        <div className="container-content">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="section-heading">Visual workflow builder</h2>
            <p className="section-subtext">
              See your automation at a glance. Trigger and actions in one place—edit, reorder, and debug without digging through code.
            </p>
          </div>
          <div className="mt-16 flex justify-center">
            <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-neutral-50/50 p-8 shadow-soft">
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border-2 border-brand-200 bg-white px-5 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-body font-semibold text-brand-700">1</span>
                  <div>
                    <p className="text-caption font-medium text-neutral-500">TRIGGER</p>
                    <p className="text-body font-medium text-neutral-900">When webhook received</p>
                  </div>
                </div>
                <div className="ml-6 h-6 w-0.5 bg-neutral-200" />
                <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-body font-semibold text-neutral-600">2</span>
                  <div>
                    <p className="text-caption font-medium text-neutral-500">ACTION</p>
                    <p className="text-body font-medium text-neutral-900">Send email</p>
                  </div>
                </div>
                <div className="ml-6 h-6 w-0.5 bg-neutral-200" />
                <div className="flex items-center gap-4 rounded-xl border-2 border-dashed border-neutral-300 bg-white/50 px-5 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">+</span>
                  <p className="text-body font-medium text-neutral-500">Add step</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 flex justify-center">
            <Button variant="primary" size="lg" onClick={() => router.push("/signup")}>
              Start for Free
            </Button>
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
