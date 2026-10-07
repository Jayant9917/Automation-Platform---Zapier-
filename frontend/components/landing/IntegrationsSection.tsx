"use client";

import { FadeInSection } from "./FadeInSection";

const APPS = [
  "Slack", "Gmail", "Notion", "Stripe", "Airtable", "GitHub",
  "Google Sheets", "Discord", "Linear", "Figma", "HubSpot", "Salesforce",
];

export function IntegrationsSection() {
  return (
    <FadeInSection>
      <section className="section-padding border-t border-neutral-100 bg-neutral-50/50">
        <div className="container-content text-center">
          <h2 className="section-heading">Integrations that fit your stack</h2>
          <p className="section-subtext">
            Connect to the tools your team uses every day. New integrations added regularly.
          </p>
          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {APPS.map((name) => (
              <div
                key={name}
                className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white py-6 text-body font-medium text-neutral-600 transition-colors duration-fast hover:border-neutral-300 hover:text-neutral-900"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
