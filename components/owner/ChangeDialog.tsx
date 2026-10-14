"use client";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmCard } from "@/components/chat/ConfirmCard";
import { executeOwnerChange, previewOwnerChange, rejectOwnerChange, uploadDishImageAction } from "@/app/actions/owner";
import type { OwnerChangeSchemaName } from "@/lib/agents/owner/change-schemas";

/** The same before → after Confirm card as the chat, for changes started from owner pages. */
export function ChangeDialog({ change, onClose }: { change: { name: OwnerChangeSchemaName; args: Record<string, unknown>; title: string } | null; onClose: (applied: boolean) => void }) {
  return (
    <Dialog open={!!change} onClose={() => onClose(false)} title={change?.title ?? ""} className="max-w-lg">
      {change && (
        <ConfirmCard
          args={change.args}
          status="executing"
          preview={(a) => previewOwnerChange(change.name, a)}
          execute={(a) => executeOwnerChange(change.name, a)}
          reject={(a) => rejectOwnerChange(change.name, a)}
          upload={uploadDishImageAction}
          respond={async (r) => {
            setTimeout(() => onClose((r as { status?: string })?.status === "confirmed"), 600);
          }}
        />
      )}
    </Dialog>
  );
}
