"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Feature } from "./Feature";

export const Hero = () => {
  const router = useRouter();

  return (
    <section className="container-content pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-display-lg text-neutral-900 md:text-4xl">
          Automate as fast as you can type
        </h1>
        <p className="mt-6 text-body text-neutral-600 leading-relaxed">
          AI gives you automation superpowers. Pairing AI and Automate helps you
          turn ideas into workflows that work for you.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push("/signup")}
          >
            Get started free
          </Button>
          <Button variant="secondary" size="lg" onClick={() => {}}>
            Contact sales
          </Button>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 md:gap-12">
          <Feature title="Free forever" subtitle="for core features" />
          <Feature title="More apps" subtitle="than any other platform" />
          <Feature title="Cutting edge" subtitle="AI features" />
        </div>
      </div>
    </section>
  );
};
