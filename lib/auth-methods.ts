/**
 * Which sign-in methods the Supabase project has switched on, so the login and
 * signup pages never offer a button that ends in "provider is not enabled".
 * Turning one on in the Supabase dashboard makes its button appear within five minutes.
 */
export interface AuthMethods {
  google: boolean;
  phone: boolean;
}

export async function getAuthMethods(): Promise<AuthMethods> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { google: false, phone: false };
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 } });
    if (!res.ok) return { google: false, phone: false };
    const { external } = (await res.json()) as { external?: Record<string, boolean> };
    return { google: external?.google === true, phone: external?.phone === true };
  } catch {
    return { google: false, phone: false };
  }
}
