import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 font-display text-4xl sm:text-5xl">Welcome back</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
