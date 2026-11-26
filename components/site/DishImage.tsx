"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { dishArt } from "./dish-art";

/** Dish photo with a graceful fallback: the dish's category illustration, then the placeholder. */
export function DishImage({ src, alt, className, priority, fallbackHint }: { src: string | null; alt: string; className?: string; priority?: boolean; fallbackHint?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={!src || failed ? dishArt(fallbackHint) : src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      width={400}
      height={400}
      onError={() => setFailed(true)}
      className={cn("aspect-square w-full object-cover", className)}
    />
  );
}
