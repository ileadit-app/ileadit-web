import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { AverageMechanicSection } from "@/components/marketing/AverageMechanicSection";
import { CompanySection } from "@/components/marketing/CompanySection";
import { PrivacySection } from "@/components/marketing/PrivacySection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { DownloadSection } from "@/components/marketing/DownloadSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <AverageMechanicSection />
      <CompanySection />
      <PrivacySection />
      <PricingSection />
      <DownloadSection />
    </>
  );
}
