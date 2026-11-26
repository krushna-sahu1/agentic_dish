// Session-aware CTAs: never prerender.
export const dynamic = "force-dynamic";

/**
 * The home page is the owner-facing product landing page. It brings its own
 * floating nav and one-line footer, so it does not use the restaurant SiteShell
 * (no announcement bar, no site footer, no customer chat launcher).
 */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
