"use client";

import { useRouter } from "next/navigation";
import { FadeInSection } from "./FadeInSection";
import { Button } from "@/components/ui/Button";

export function FinalCTASection() {
  const router = useRouter();

  return (
    <FadeInSection>
      <section className="section-padding bg-neutral-900">
        <div className="container-content text-center">
          <h2 className="text-display-sm font-semibold tracking-tight text-white md:text-display">
            Ready to automate?
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-body text-neutral-400">
            Join teams who ship faster. Start free—no credit card required.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push("/signup")}
              className="!bg-white !text-neutral-900 hover:!bg-neutral-100"
            >
              Start for Free
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.push("/login")}
              className="!text-white hover:!bg-white/10"
            >
              Log in
            </Button>
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
