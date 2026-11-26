import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/site/AuthFrame";
import { SignupForm } from "@/components/site/AuthForms";
import { getAuthMethods } from "@/lib/auth-methods";

export const metadata: Metadata = { title: "Sign up" };

export default async function Page() {
  const methods = await getAuthMethods();
  return (
    <AuthFrame title="Create your account" subtitle="Save your allergies and address once — the AI host checks them on every order.">
      <Suspense>
        <SignupForm methods={methods} />
      </Suspense>
    </AuthFrame>
  );
}
