import type { Metadata } from "next";
import { AskAiButton } from "@/components/site/AskAiButton";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl pb-10 pt-10 sm:pt-14">
      <h1 className="font-display text-[2.6rem] leading-[1] sm:text-6xl">About {BRAND.name}</h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          We started as a tiny tiffin counter in Saheed Nagar, grinding our own dosa batter every night. Today our kitchen brings together two food
          cultures we love: the crisp dosas, idlis and filter coffee of South India, and the comforting Odia home food — dalma, pakhala, chhena poda —
          that Bhubaneswar grew up on.
        </p>
        <p>
          Everything is made fresh each day. We mark allergens on every dish, cook with less oil on request, and are happy to make most dishes milder
          (or spicier!).
        </p>
        <p>
          Our website has an AI host that can answer questions about the menu, suggest combos for your group and add dishes to your cart. It never
          handles your payment — you always pay yourself through Razorpay&apos;s secure checkout.
        </p>
      </div>
      <AskAiButton className="mt-8" prompt="Tell me about your Odia specials" label="Ask about our Odia specials" />
    </div>
  );
}
