import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/owner/SettingsForm";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/services/settings";

export const metadata = { title: "Settings" };

export default async function OwnerSettingsPage() {
  const user = await requireRole(["owner", "staff"]);
  if (user.role !== "owner") redirect("/owner");
  return <SettingsForm settings={await getSettings()} />;
}
