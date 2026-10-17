import { SiteShell } from "@/components/site/SiteShell";

// Live menu/availability and per-user session: never prerender.
export const dynamic = "force-dynamic";

/**
 * The landing page gets full-bleed sections plus its own scoped "AI" theme.
 * `data-theme="ai"` remaps the design tokens (and the chat surface) for this
 * route only — the owner dashboard and every other page stay unchanged.
 */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="ai">
      <SiteShell bleed showChat={false}>{children}</SiteShell>
    </div>
  );
}
