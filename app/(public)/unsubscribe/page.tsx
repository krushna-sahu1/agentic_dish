import type { Metadata } from "next";
import { UnsubscribeButton } from "@/components/site/UnsubscribeButton";
import { verifyUnsubscribe } from "@/lib/bulk-email/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e, t } = await searchParams;
  const email = verifyUnsubscribe(e, t);
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-4xl">Email preferences</h1>
      {email && e && t ? (
        <>
          <p className="mt-3 text-muted-foreground">
            Stop offers and updates to <b className="text-foreground">{email}</b>? Order and receipt emails will still arrive.
          </p>
          <UnsubscribeButton e={e} t={t} />
        </>
      ) : (
        <p className="mt-3 text-muted-foreground">This unsubscribe link isn&apos;t valid. If you&apos;re signed in, you can turn offer emails off on your profile page.</p>
      )}
    </div>
  );
}
