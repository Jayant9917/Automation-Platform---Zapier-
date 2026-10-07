"use client";

import { FadeInSection } from "./FadeInSection";

const PAINS = [
  {
    title: "Manual work that doesn’t scale",
    description: "Copy-paste between tools, repeat the same tasks, and chase updates instead of building.",
  },
  {
    title: "Integrations that break or never ship",
    description: "Custom code and one-off scripts that are hard to maintain and impossible to hand off.",
  },
  {
    title: "Time lost on busywork",
    description: "Hours every week on repetitive workflows that could run in the background.",
  },
];

export function ProblemSection() {
  return (
    <FadeInSection>
      <section className="section-padding bg-neutral-50/50">
        <div className="container-content text-center">
          <h2 className="section-heading">
            Your team is stuck in the middle
          </h2>
          <p className="section-subtext">
            Between the apps you love and the work that actually moves the needle. Automation should simplify that—not add another layer of complexity.
          </p>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {PAINS.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-neutral-200 bg-white p-8 text-left transition-all duration-fast hover:border-neutral-300 hover:shadow-soft"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                  <span className="text-body font-semibold">{i + 1}</span>
                </div>
                <h3 className="text-title-sm text-neutral-900">{item.title}</h3>
                <p className="mt-2 text-body text-neutral-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
