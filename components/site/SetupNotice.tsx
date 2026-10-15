/** Shown when Supabase isn't configured / migrated yet, instead of a crash. */
export function SetupNotice({ error }: { error: string }) {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-20">
      <h1 className="font-display text-4xl sm:text-5xl">Almost there</h1>
      <p className="mt-3 text-muted-foreground">
        The restaurant database isn&apos;t reachable yet. Set the Supabase variables in <code>.env.local</code>, run the migrations and the seed
        (see README → Setup), then reload.
      </p>
      <pre className="mt-6 overflow-auto rounded-lg bg-muted p-4 text-xs">{error}</pre>
    </main>
  );
}
