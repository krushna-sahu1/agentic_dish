import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OwnerShell } from "@/components/owner/OwnerShell";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Owner assistant", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/owner");
  if (user.role !== "owner" && user.role !== "staff") redirect("/");
  return (
    <OwnerShell role={user.role} name={user.profile?.full_name ?? null}>
      {children}
    </OwnerShell>
  );
}
