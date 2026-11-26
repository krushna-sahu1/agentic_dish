import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/site/AuthFrame";
import { ResetPasswordForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return (
    <AuthFrame title="Reset your password" subtitle="We'll email you a secure link to choose a new one.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthFrame>
  );
}
