import { SiteShell } from "@/components/site/SiteShell";

// Live menu/availability and per-user session: never prerender.
export const dynamic = "force-dynamic";

/**
 * The home page gets full-bleed sections. `data-theme="ai"` only scopes the
 * shared chat-surface styles; colours come from the global design tokens.
 */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="ai">
      <SiteShell bleed showChat={false}>{children}</SiteShell>
    </div>
  );
}
