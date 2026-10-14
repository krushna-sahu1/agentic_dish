"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Dish photo with a graceful fallback to the placeholder illustration. */
export function DishImage({ src, alt, className, priority }: { src: string | null; alt: string; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={!src || failed ? "/dishes/placeholder.svg" : src}
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
