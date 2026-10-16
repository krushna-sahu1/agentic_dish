import { redirect } from "next/navigation";
import type { Viewport } from "next";
import { JarvisExperience } from "@/components/jarvis/JarvisExperience";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Jarvis" };

/** Edge-to-edge on phones so env(safe-area-inset-*) works inside the voice UI. */
export const viewport: Viewport = {
  themeColor: "#03050b",
  colorScheme: "dark",
  viewportFit: "cover",
};

/** Owner-only voice assistant. Staff are sent back to the dashboard. */
export default async function JarvisPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/owner/jarvis");
  if (user.role !== "owner") redirect("/owner");
  return <JarvisExperience />;
}
