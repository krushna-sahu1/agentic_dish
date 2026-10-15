import type { Metadata } from "next";
import { ProfileForm } from "@/components/site/ProfileForm";
import { AddressForm } from "@/components/site/AddressForm";
import { DeleteAddressButton } from "@/components/site/DeleteAddressButton";
import { requireUser } from "@/lib/auth";
import { getProfile, listAddresses } from "@/lib/services/account";
import { OfferEmailsToggle } from "@/components/site/OfferEmailsToggle";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, addresses, unsub] = await Promise.all([
    getProfile(user.userId),
    listAddresses(user.userId),
    user.email ? createAdminClient().from("email_unsubscribes").select("email").eq("email", user.email.toLowerCase()).maybeSingle() : null,
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <h1 className="font-display text-4xl sm:text-5xl">Your profile</h1>
      <section className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">{user.email}</p>
        <ProfileForm profile={profile} />
        <div className="mt-5 border-t pt-4">
          <OfferEmailsToggle initial={!unsub?.data} />
        </div>
      </section>
      <section id="addresses" className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">Addresses</h2>
        <ul className="mb-4 space-y-2 text-sm">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
              <span>
                <b>{a.label}</b>{a.is_default ? " (default)" : ""}: {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city} {a.pincode}
              </span>
              <DeleteAddressButton id={a.id} />
            </li>
          ))}
          {addresses.length === 0 && <li className="text-muted-foreground">No addresses yet.</li>}
        </ul>
        <AddressForm />
      </section>
    </div>
  );
}
