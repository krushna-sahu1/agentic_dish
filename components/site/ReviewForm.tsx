"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { submitReviewAction } from "@/app/actions/customer";
import { cn } from "@/lib/utils";

export function ReviewForm({ orderId, items }: { orderId: string; items: { id: string; name: string }[] }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [item, setItem] = useState(items[0]?.id ?? "");
  const [pending, start] = useTransition();
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-semibold">How was your food?</h2>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rating) return void toast.error("Pick a star rating");
          start(async () => {
            const r = await submitReviewAction({ order_id: orderId, rating, comment: comment || undefined, item_id: item || undefined });
            if (!r.ok) return void toast.error(r.error);
            toast.success("Thanks for your review!");
            router.refresh();
          });
        }}
      >
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
              <Star className={cn("size-7", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
        {items.length > 1 && (
          <div>
            <Label htmlFor="rv-item">Which dish?</Label>
            <Select id="rv-item" value={item} onChange={(e) => setItem(e.target.value)}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </Select>
          </div>
        )}
        <Textarea aria-label="Comment" placeholder="Tell us more (optional)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
        <Button type="submit" disabled={pending}>Submit review</Button>
      </form>
    </section>
  );
}
