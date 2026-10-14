/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Delivery check: coordinates within radius when known, else pincode allow-list. */
export function isDeliverable(
  address: { lat: number | null; lng: number | null; pincode: string },
  settings: { lat: number | null; lng: number | null; delivery_radius_km: number; serviceable_pincodes: string[] },
): { ok: boolean; distanceKm: number | null; reason?: string } {
  if (address.lat != null && address.lng != null && settings.lat != null && settings.lng != null) {
    const d = haversineKm({ lat: address.lat, lng: address.lng }, { lat: settings.lat, lng: settings.lng });
    return d <= settings.delivery_radius_km
      ? { ok: true, distanceKm: Math.round(d * 10) / 10 }
      : { ok: false, distanceKm: Math.round(d * 10) / 10, reason: `That address is ${d.toFixed(1)} km away; we deliver within ${settings.delivery_radius_km} km.` };
  }
  if (settings.serviceable_pincodes.length === 0 || settings.serviceable_pincodes.includes(address.pincode)) {
    return { ok: true, distanceKm: null };
  }
  return { ok: false, distanceKm: null, reason: `We don't deliver to pincode ${address.pincode} yet.` };
}
