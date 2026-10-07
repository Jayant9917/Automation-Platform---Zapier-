"use client";

import { FadeInSection } from "./FadeInSection";

const LOGOS = [
  { name: "Slack", w: 80 },
  { name: "Gmail", w: 72 },
  { name: "Notion", w: 76 },
  { name: "Stripe", w: 82 },
  { name: "Airtable", w: 88 },
];

export function SocialProofSection() {
  return (
    <FadeInSection>
      <section className="section-padding border-b border-neutral-100 bg-white">
        <div className="container-content">
          <p className="text-center text-body-sm font-medium text-neutral-500">
            Works with the tools you already use
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
            {LOGOS.map(({ name, w }) => (
              <div
                key={name}
                className="flex h-10 items-center justify-center text-neutral-400 transition-colors duration-fast hover:text-neutral-600"
                style={{ width: w }}
              >
                <span className="text-lg font-semibold tracking-tight">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
