import { SiteShell } from "@/components/site/SiteShell";

// Live menu/availability and per-user session: never prerender.
export const dynamic = "force-dynamic";

/** The landing page gets full-bleed sections; every other page uses the padded (public) layout. */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell bleed>{children}</SiteShell>;
}
