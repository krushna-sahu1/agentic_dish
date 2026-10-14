"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/providers/SessionProvider";
import { toggleFavoriteAction } from "@/app/actions/customer";
import { cn } from "@/lib/utils";

export function FavoriteButton({ itemId, initial = false }: { itemId: string; initial?: boolean }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={fav}
      aria-label={fav ? "Remove from favourites" : "Add to favourites"}
      disabled={pending}
      onClick={() => {
        if (!session) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
        start(async () => {
          const r = await toggleFavoriteAction(itemId);
          if (!r.ok) return void toast.error(r.error);
          setFav(r.data.favorite);
          toast.success(r.data.favorite ? "Saved to favourites" : "Removed from favourites");
        });
      }}
    >
      <Heart className={cn(fav && "fill-primary text-primary")} />
    </Button>
  );
}
