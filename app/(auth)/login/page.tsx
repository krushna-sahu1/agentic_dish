import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/site/AuthFrame";
import { LoginForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <AuthFrame title="Welcome back" subtitle="Log in to order, track and reorder your usual in one line.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
