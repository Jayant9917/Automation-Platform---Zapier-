"use client";

import { FadeInSection } from "./FadeInSection";

const STEPS = [
  {
    step: "1",
    title: "Pick a trigger",
    description: "Choose when your workflow should run—incoming webhook, schedule, or app event.",
    icon: TriggerIcon,
  },
  {
    step: "2",
    title: "Add actions",
    description: "Connect the apps and steps that run automatically. No code required.",
    icon: ActionIcon,
  },
  {
    step: "3",
    title: "Ship and scale",
    description: "Publish once. Your automation runs in the background while you focus on building.",
    icon: ShipIcon,
  },
];

function TriggerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75v-4.5m0 4.5h4.5m-4.5 0l6-6m-3 18c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.42.92l1.106 1.299c.293.365.759.467 1.12.257l1.047-.635a.75.75 0 01.375-.131 17.75 17.75 0 003.375 0 .75.75 0 01.375.131l1.047.635c.361.21.827.108 1.12-.257l1.106-1.3a2.25 2.25 0 011.42-.92h1.372A2.25 2.25 0 0121 4.5v1.372c0 .516-.351.966-.92 1.42l-1.299 1.106a1.5 1.5 0 00-.257 1.12l.635 1.047a.75.75 0 01-.131.375A17.75 17.75 0 0112 21z" />
    </svg>
  );
}

function ActionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ShipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

export function HowItWorksSection() {
  return (
    <FadeInSection>
      <section id="how-it-works" className="section-padding bg-white scroll-mt-20">
        <div className="container-content text-center">
          <h2 className="section-heading">How it works</h2>
          <p className="section-subtext">
            Three steps to your first automation. No engineering ticket, no waiting.
          </p>
          <div className="mt-20 grid gap-12 md:grid-cols-3">
            {STEPS.map(({ step, title, description, icon: Icon }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-brand-600">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mt-6 text-title text-neutral-900">{title}</h3>
                <p className="mt-3 text-body text-neutral-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
