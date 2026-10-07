"use client";

import { FadeInSection } from "./FadeInSection";

const QUOTES = [
  {
    quote: "We cut manual data entry by 80%. Setup took an afternoon, not a sprint.",
    author: "Alex Chen",
    role: "Head of Ops, Fintech",
  },
  {
    quote: "Finally, automation that doesn’t need a ticket. Our team ships workflows without waiting on engineering.",
    author: "Jordan Lee",
    role: "Product Lead",
  },
  {
    quote: "Reliable, simple, and fast. We moved from custom scripts to this in a week.",
    author: "Sam Rivera",
    role: "CTO, Startup",
  },
];

export function TestimonialsSection() {
  return (
    <FadeInSection>
      <section className="section-padding bg-white">
        <div className="container-content text-center">
          <h2 className="section-heading">Loved by teams who ship</h2>
          <p className="section-subtext">
            See why teams switch to Automate to run workflows without the complexity.
          </p>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {QUOTES.map(({ quote, author, role }) => (
              <div
                key={author}
                className="rounded-2xl border border-neutral-200 bg-neutral-50/30 p-8 text-left transition-all duration-fast hover:border-neutral-300 hover:shadow-soft"
              >
                <p className="text-body text-neutral-700 leading-relaxed">&ldquo;{quote}&rdquo;</p>
                <div className="mt-6">
                  <p className="text-body font-semibold text-neutral-900">{author}</p>
                  <p className="text-body-sm text-neutral-500">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
