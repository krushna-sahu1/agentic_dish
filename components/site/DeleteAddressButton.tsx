"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAddressAction } from "@/app/actions/customer";

export function DeleteAddressButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Delete address"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteAddressAction(id);
          router.refresh();
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
