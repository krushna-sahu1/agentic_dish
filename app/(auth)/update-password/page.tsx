import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/site/AuthFrame";
import { UpdatePasswordForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Update password" };

export default function Page() {
  return (
    <AuthFrame title="Choose a new password" subtitle="Pick something you haven’t used here before.">
      <Suspense>
        <UpdatePasswordForm />
      </Suspense>
    </AuthFrame>
  );
}
