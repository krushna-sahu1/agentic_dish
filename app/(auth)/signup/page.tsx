import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/site/AuthFrame";
import { SignupForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Sign up" };

export default function Page() {
  return (
    <AuthFrame title="Create your account" subtitle="Save your allergies and address once — the AI host checks them on every order.">
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthFrame>
  );
}
