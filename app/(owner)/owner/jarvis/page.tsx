import { redirect } from "next/navigation";
import { JarvisExperience } from "@/components/jarvis/JarvisExperience";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Jarvis" };

/** Owner-only voice assistant. Staff are sent back to the dashboard. */
export default async function JarvisPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/owner/jarvis");
  if (user.role !== "owner") redirect("/owner");
  return <JarvisExperience />;
}
