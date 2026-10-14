import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 font-display text-3xl font-semibold">Reset your password</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
