import { SiteShell } from "@/components/site/SiteShell";

// Live menu/availability and per-user session: never prerender.
export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
