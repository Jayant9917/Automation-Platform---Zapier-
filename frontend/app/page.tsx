import { MarketingLayout } from "@/components/layout/MarketingLayout";
import {
  HeroSection,
  SocialProofSection,
  ProblemSection,
  HowItWorksSection,
  FeatureSection,
  BuilderPreviewSection,
  IntegrationsSection,
  TestimonialsSection,
  PricingPreviewSection,
  FinalCTASection,
  LandingFooter,
} from "@/components/landing";

export default function Home() {
  return (
    <MarketingLayout>
      <main>
        <HeroSection />
        <SocialProofSection />
        <ProblemSection />
        <HowItWorksSection />
        <FeatureSection />
        <BuilderPreviewSection />
        <IntegrationsSection />
        <TestimonialsSection />
        <PricingPreviewSection />
        <FinalCTASection />
        <LandingFooter />
      </main>
    </MarketingLayout>
  );
}
