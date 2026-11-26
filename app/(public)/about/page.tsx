import type { Metadata } from "next";
import { AskAiButton } from "@/components/site/AskAiButton";
import { BRAND, BUSINESS } from "@/lib/business";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl py-12 sm:py-16">
      <h1 className="font-display text-5xl sm:text-6xl">About {BRAND.name}</h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted-foreground">
        {BUSINESS.about.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
      <AskAiButton className="mt-10" prompt={BUSINESS.aboutPrompt.message} label={BUSINESS.aboutPrompt.label} />
    </div>
  );
}
