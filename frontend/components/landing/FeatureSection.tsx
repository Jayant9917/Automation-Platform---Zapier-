"use client";

import { FadeInSection } from "./FadeInSection";

const FEATURES = [
  {
    title: "No-code builder",
    description: "Drag-and-drop workflow editor. Connect triggers and actions in minutes, not days.",
    icon: ZapIcon,
  },
  {
    title: "Powerful integrations",
    description: "Connect to the apps your team already uses. More integrations, fewer custom scripts.",
    icon: PuzzleIcon,
  },
  {
    title: "Runs in the background",
    description: "Set it once and forget it. Reliable execution with visibility when you need it.",
    icon: ShieldIcon,
  },
  {
    title: "Built for speed",
    description: "From idea to live automation in minutes. No deployment, no engineering handoff.",
    icon: BoltIcon,
  },
];

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function PuzzleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c0 .271.108.517.283.696.48.4 1.054.755 1.693 1.053A49.856 49.856 0 0112 13.485a49.51 49.51 0 01-5.236-.501 6.888 6.888 0 001.693-1.053A.96.96 0 007.5 12.9v0a.656.656 0 01-.658-.663c0-1.657.129-3.294.315-4.907a48.693 48.693 0 01-4.163.3.64.64 0 01-.657-.643v0z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

export function FeatureSection() {
  return (
    <FadeInSection>
      <section className="section-padding bg-neutral-50/50">
        <div className="container-content text-center">
          <h2 className="section-heading">Built for automation that just works</h2>
          <p className="section-subtext">
            Everything you need to connect apps, automate workflows, and ship faster—without the overhead.
          </p>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-neutral-200 bg-white p-8 text-left transition-all duration-fast hover:border-neutral-300 hover:shadow-soft"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-title-sm text-neutral-900">{title}</h3>
                <p className="mt-2 text-body text-neutral-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
