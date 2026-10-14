import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { HoursList } from "@/components/site/Footer";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto grid max-w-4xl gap-10 py-10 md:grid-cols-2">
      <div>
        <h1 className="font-display text-4xl font-semibold">Contact us</h1>
        <ul className="mt-6 space-y-3 text-sm">
          <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-primary" /> {s.address}</li>
          <li className="flex items-center gap-2"><Phone className="size-4 text-primary" /> <a className="hover:underline" href={`tel:${s.phone?.replace(/\s/g, "")}`}>{s.phone}</a></li>
          <li className="flex items-center gap-2"><Mail className="size-4 text-primary" /> <a className="hover:underline" href={`mailto:${s.email}`}>{s.email}</a></li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Delivery within {s.delivery_radius_km} km · free delivery above ₹{s.free_delivery_above_paise / 100} · minimum order ₹{s.min_order_paise / 100}.
        </p>
      </div>
      <div>
        <h2 className="mb-3 font-semibold">Opening hours</h2>
        <HoursList settings={s} />
      </div>
    </div>
  );
}
