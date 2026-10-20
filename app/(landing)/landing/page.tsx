import { Architecture } from "@/components/marketing/Architecture";
import { Closing } from "@/components/marketing/Closing";
import { Comparison } from "@/components/marketing/Comparison";
import { DinerFeatures, OwnerFeatures } from "@/components/marketing/Features";
import { Faq } from "@/components/marketing/Faq";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Pricing } from "@/components/marketing/Pricing";
import { ProductDemo } from "@/components/marketing/ProductDemo";
import { Proof } from "@/components/marketing/Proof";
import { Shift } from "@/components/marketing/Shift";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteNav } from "@/components/marketing/SiteNav";
import { Trust } from "@/components/marketing/Trust";
import { ViewProvider } from "@/components/marketing/ViewProvider";
import { CONTACT, SITE } from "@/lib/landing/config";

/**
 * Agentic Eats marketing page.
 *
 * Everything on this page comes from lib/landing/config.ts — swap the brand,
 * the contact details or the pricing there and this page follows.
 */
export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    email: CONTACT.email,
    logo: `${SITE.url}${SITE.logo}`,
  };

  return (
    <ViewProvider>
      <SiteNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero />
      <Shift />
      <Architecture />
      <DinerFeatures />
      <OwnerFeatures />
      <ProductDemo />
      <Trust />
      <HowItWorks />
      <Comparison />
      <Proof />
      <Faq />
      <Pricing />
      <Closing />

      <SiteFooter />
    </ViewProvider>
  );
}
