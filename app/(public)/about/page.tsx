import type { Metadata } from "next";
import { AskAiButton } from "@/components/site/AskAiButton";
import { BRAND, BUSINESS } from "@/lib/business";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl pb-10 pt-10 sm:pt-14">
      <h1 className="font-display text-[2.6rem] leading-[1] sm:text-6xl">About {BRAND.name}</h1>
      <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-muted-foreground">
        {BUSINESS.about.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
      <AskAiButton className="mt-8" prompt={BUSINESS.aboutPrompt.message} label={BUSINESS.aboutPrompt.label} />
    </div>
  );
}
