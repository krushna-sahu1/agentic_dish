"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addAddressAction } from "@/app/actions/customer";

export function AddressForm({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ label: "Home", line1: "", line2: "", city: "Bhubaneswar", pincode: "" });
  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addAddressAction({ ...f, line2: f.line2 || null, is_default: true });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Address saved");
          setF({ label: "Home", line1: "", line2: "", city: "Bhubaneswar", pincode: "" });
          onSaved?.();
          router.refresh();
        });
      }}
    >
      <div>
        <Label htmlFor="a-label">Label</Label>
        <Input id="a-label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="a-pin">Pincode</Label>
        <Input id="a-pin" inputMode="numeric" pattern="[0-9]{6}" required value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="a-line1">Address line 1</Label>
        <Input id="a-line1" required autoComplete="address-line1" value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="a-line2">Landmark (optional)</Label>
        <Input id="a-line2" autoComplete="address-line2" value={f.line2} onChange={(e) => setF({ ...f, line2: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="a-city">City</Label>
        <Input id="a-city" required value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      </div>
      <Button type="submit" disabled={pending} className="sm:col-span-2">Save address</Button>
    </form>
  );
}
