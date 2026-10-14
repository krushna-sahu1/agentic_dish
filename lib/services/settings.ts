import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOpenStatus, type OpeningHours } from "@/lib/time";
import type { PricingSettings } from "@/lib/pricing";
import type { Settings } from "@/lib/types";

export const getSettings = cache(async (): Promise<Settings> => {
  const { data, error } = await createAdminClient().from("restaurant_settings").select("*").limit(1).single();
  if (error || !data) throw new Error(`restaurant_settings missing: ${error?.message ?? "no row"}`);
  return { ...data, gst_percent: Number(data.gst_percent), delivery_radius_km: Number(data.delivery_radius_km) } as Settings;
});

export function pricingSettings(s: Settings): PricingSettings {
  return {
    gstPercent: s.gst_percent,
    packagingFeePaise: s.packaging_fee_paise,
    deliveryFeePaise: s.delivery_fee_paise,
    freeDeliveryAbovePaise: s.free_delivery_above_paise,
  };
}

export function openStatus(s: Settings, now = new Date()) {
  return computeOpenStatus(
    { openingHours: s.opening_hours as OpeningHours, override: s.is_open_override, acceptingOrders: s.accepting_orders, tz: s.timezone },
    now,
  );
}

export async function getRestaurantInfo() {
  const s = await getSettings();
  const status = openStatus(s);
  return {
    name: s.name,
    tagline: s.tagline,
    phone: s.phone,
    email: s.email,
    address: s.address,
    opening_hours: s.opening_hours,
    open_now: status.isOpen && s.accepting_orders,
    status_label: !s.accepting_orders ? "Not accepting online orders right now" : status.label,
    delivery_fee_paise: s.delivery_fee_paise,
    free_delivery_above_paise: s.free_delivery_above_paise,
    delivery_radius_km: s.delivery_radius_km,
    min_order_paise: s.min_order_paise,
    packaging_fee_paise: s.packaging_fee_paise,
    gst_percent: s.gst_percent,
    avg_prep_minutes: s.avg_prep_minutes,
    announcement: s.announcement,
  };
}
