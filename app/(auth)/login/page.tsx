import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/site/AuthFrame";
import { LoginForm } from "@/components/site/AuthForms";
import { getAuthMethods } from "@/lib/auth-methods";

export const metadata: Metadata = { title: "Log in" };

export default async function Page() {
  const methods = await getAuthMethods();
  return (
    <AuthFrame title="Welcome back" subtitle="Log in to order, track and reorder your usual in one line.">
      <Suspense>
        <LoginForm methods={methods} />
      </Suspense>
    </AuthFrame>
  );
}
