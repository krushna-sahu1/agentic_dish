import { Sparkles } from "lucide-react";

/**
 * Two-column frame for the auth pages: the form on the left, and on large screens a dark
 * panel that previews what the AI host remembers once you're signed in.
 */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
      <div className="mx-auto w-full max-w-sm lg:py-10">
        <h1 className="font-display text-[2.6rem] leading-[1] sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden rounded-[28px] bg-[#14130f] p-10 text-[#f4f3ef] lg:flex lg:flex-col lg:justify-between dark:border dark:bg-card"
      >
        <div className="absolute inset-0 [background-image:radial-gradient(#2a2a2f_1px,transparent_1px)] [background-size:22px_22px]" />
        <p className="relative font-mono text-xs text-[#a8a59d]">Once you&apos;re in, the host remembers</p>
        <div className="relative my-10 flex max-w-md flex-col gap-3">
          <p className="self-end rounded-[18px] rounded-br-[4px] bg-[#f4f3ef] px-4 py-2.5 text-[15px] text-[#14130f]">Reorder my usual.</p>
          <p className="flex items-center gap-2 font-mono text-xs text-[#a99dff]">
            <Sparkles className="size-3.5" /> reorder(last_order) · allergens re-checked
          </p>
          <p className="rounded-[18px] border border-[#2a2a2f] bg-[#1c1c20] px-4 py-3.5 text-[15px] leading-relaxed">
            Added your usual — same address as last time?
          </p>
        </div>
        <div className="relative">
          <p className="font-display text-[2.4rem] leading-[1.02]">Your allergies, your address, your usual — remembered.</p>
          <p className="mt-3 max-w-md text-[15px] text-[#b3b0a8]">Saved once in your profile. Checked on every order, whether you tap or talk.</p>
        </div>
      </aside>
    </div>
  );
}
