import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SiteShell } from "@/components/site/SiteShell";
import { getSessionUser } from "@/lib/auth";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "/";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return <SiteShell>{children}</SiteShell>;
}
