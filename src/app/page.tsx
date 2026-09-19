import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { AverageMechanicSection } from "@/components/marketing/AverageMechanicSection";
import { TeamsSection } from "@/components/marketing/TeamsSection";
import { PrivacySection } from "@/components/marketing/PrivacySection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { DownloadSection } from "@/components/marketing/DownloadSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <AverageMechanicSection />
      <TeamsSection />
      <PrivacySection />
      <PricingSection />
      <DownloadSection />
    </>
  );
}
