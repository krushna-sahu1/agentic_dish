"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { updateProfileAction } from "@/app/actions/customer";
import { ALLERGENS, DIETARY_PREFS, type Profile } from "@/lib/types";
import { spiceLabel } from "@/lib/format";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [f, setF] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    dietary_prefs: profile.dietary_prefs as string[],
    spice_tolerance: profile.spice_tolerance,
    allergies: profile.allergies,
  });
  const [pending, start] = useTransition();
  const toggle = (key: "dietary_prefs" | "allergies", v: string) =>
    setF({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateProfileAction({ ...f, phone: f.phone || null });
          if (!r.ok) toast.error(r.error);
          else toast.success("Profile saved — our AI will respect these preferences.");
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pname">Name</Label>
          <Input id="pname" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="pphone">Phone</Label>
          <Input id="pphone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Dietary preferences</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {DIETARY_PREFS.map((d) => (
            <label key={d} className="flex items-center gap-1.5 capitalize">
              <input type="checkbox" className="accent-[var(--primary)]" checked={f.dietary_prefs.includes(d)} onChange={() => toggle("dietary_prefs", d)} /> {d.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Allergies</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {ALLERGENS.map((a) => (
            <label key={a} className="flex items-center gap-1.5 capitalize">
              <input type="checkbox" className="accent-[var(--primary)]" checked={f.allergies.includes(a)} onChange={() => toggle("allergies", a)} /> {a}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        <span className="font-medium">Spice tolerance: {spiceLabel(f.spice_tolerance)}</span>
        <input type="range" min={0} max={5} className="mt-1 w-full accent-[var(--primary)]" value={f.spice_tolerance} onChange={(e) => setF({ ...f, spice_tolerance: Number(e.target.value) })} />
      </label>
      <Button type="submit" disabled={pending}>Save profile</Button>
    </form>
  );
}
