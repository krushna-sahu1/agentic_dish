"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** A dish photo, or nothing: dishes without a real photo are shown as text, never with stand-in art. */
export function DishImage({ src, alt, className, priority }: { src: string | null; alt: string; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      width={400}
      height={400}
      onError={() => setFailed(true)}
      className={cn("aspect-square object-cover", className)}
    />
  );
}
