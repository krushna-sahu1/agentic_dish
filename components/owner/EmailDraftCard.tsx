"use client";

/**
 * Bulk email preview (owner text chat + Jarvis panel). Send is the only way an
 * email goes out; the card passes the version it shows, so a draft that was
 * revised elsewhere can't be sent from a stale card.
 */
import { useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, Mail, Pencil, Send, Ticket, Users, X } from "lucide-react";
import { cancelEmailDraftAction, editEmailDraftAction, sendEmailDraftAction } from "@/app/actions/email";
import type { EmailDraftView } from "@/lib/bulk-email/schema";
import { cn } from "@/lib/utils";

type Variant = "chat" | "jarvis";
export type EmailOutcome = { status: "sent" | "failed" | "cancelled"; sent?: number; failed?: number; error?: string };

const S = {
  chat: {
    card: "my-2 w-full max-w-xl rounded-2xl border bg-card p-4 text-card-foreground shadow-sm",
    label: "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
    muted: "text-muted-foreground",
    box: "rounded-xl border bg-background/60 p-3",
    coupon: "rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-3 text-center",
    input: "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "border hover:bg-accent",
    warn: "text-amber-700 dark:text-amber-300",
  },
  jarvis: {
    card: "relative overflow-hidden rounded-2xl border border-orange-300/30 bg-white/[0.045] p-4 text-white shadow-[0_0_50px_-12px_rgba(251,146,60,0.45)] backdrop-blur-xl",
    label: "text-[11px] font-medium uppercase tracking-[0.18em] text-white/50",
    muted: "text-white/55",
    box: "rounded-xl border border-white/10 bg-white/[0.04] p-3",
    coupon: "rounded-xl border-2 border-dashed border-orange-300/50 bg-orange-400/10 p-3 text-center",
    input: "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/30",
    primary: "bg-orange-400 text-black hover:bg-orange-300",
    ghost: "border border-white/15 text-white/85 hover:bg-white/10",
    warn: "text-amber-200",
  },
} as const;

export function EmailDraftCard({ draft, variant = "chat", onOutcome, onDismiss }: { draft: EmailDraftView; variant?: Variant; onOutcome?: (o: EmailOutcome) => void; onDismiss?: () => void }) {
  const s = S[variant];
  const [view, setView] = useState(draft);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ subject: draft.subject, message: draft.message });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "save" | "cancel" | null>(null);
  const [, start] = useTransition();
  const open = view.status === "draft" && !result;
  const people = view.recipient_count === 1 ? "1 person" : `${view.recipient_count.toLocaleString("en-IN")} people`;

  const run = (kind: "send" | "save" | "cancel") =>
    start(async () => {
      setBusy(kind);
      setError(null);
      if (kind === "send") {
        const r = await sendEmailDraftAction(view.draft_id, view.version);
        if (!r.ok) {
          setError(r.error);
        } else {
          const msg = r.data.failed ? `Sent to ${r.data.sent} of ${r.data.recipient_count} (${r.data.failed} failed).` : `Sent to ${r.data.sent === 1 ? "1 person" : `${r.data.sent.toLocaleString("en-IN")} people`}.`;
          setResult(msg);
          setView((v) => ({ ...v, status: r.data.status as EmailDraftView["status"] }));
          onOutcome?.({ status: r.data.sent ? "sent" : "failed", sent: r.data.sent, failed: r.data.failed });
        }
      } else if (kind === "save") {
        const r = await editEmailDraftAction(view.draft_id, view.version, form);
        if (!r.ok) setError(r.error);
        else {
          setView(r.data);
          setEditing(false);
        }
      } else {
        const r = await cancelEmailDraftAction(view.draft_id);
        if (!r.ok) setError(r.error);
        else {
          setView(r.data);
          setResult("Cancelled — nothing was sent.");
          onOutcome?.({ status: "cancelled" });
        }
      }
      setBusy(null);
    });

  return (
    <div className={s.card} role="group" aria-label={`Email draft: ${view.subject}`}>
      <div className="mb-3 flex items-start gap-2">
        <Mail className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
        <p className={cn(s.label, "flex-1")}>{open ? "Email draft — not sent" : "Email"}</p>
        {onDismiss && !open && (
          <button onClick={onDismiss} aria-label="Dismiss email card" className="-m-1 rounded-full p-1 opacity-60 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className={cn(s.box, "mb-3 flex items-center gap-3")}>
        <Users className="size-4 shrink-0 opacity-70" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{view.audience_label}</p>
          {view.sample.length > 0 && <p className={cn("truncate text-xs", s.muted)}>{view.sample.join(", ")}{view.recipient_count > view.sample.length ? "…" : ""}</p>}
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-semibold tabular-nums leading-none">{view.recipient_count.toLocaleString("en-IN")}</span>
          <span className={cn("text-[10px] uppercase tracking-wider", s.muted)}>recipients</span>
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium">
            Subject
            <input className={cn(s.input, "mt-1")} value={form.subject} maxLength={120} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </label>
          <label className="block text-xs font-medium">
            Message
            <textarea className={cn(s.input, "mt-1 min-h-40 leading-relaxed")} value={form.message} maxLength={2000} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-base font-semibold leading-snug">{view.subject}</p>
          <div className={cn("max-h-56 overflow-auto whitespace-pre-line text-sm leading-relaxed", s.muted)}>
            <span className="font-medium">Hi &lt;first name&gt;,</span>
            {"\n"}
            {view.message}
          </div>
        </div>
      )}

      {view.coupon && (
        <div className={cn(s.coupon, "mt-3")}>
          <p className="flex items-center justify-center gap-1.5 text-lg font-bold">
            <Ticket className="size-4" aria-hidden /> {view.coupon.headline}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold tracking-widest">{view.coupon.code}</p>
          <p className={cn("mt-1 text-xs", s.muted)}>
            {view.coupon.detail} {view.coupon.validity}.
          </p>
          {open && <p className={cn("mt-1 text-[11px]", s.muted)}>The code switches on only when you tap Send.</p>}
        </div>
      )}

      {open && view.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {view.warnings.map((w) => (
            <li key={w} className={cn("flex gap-1.5 text-xs", s.warn)}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className={cn("mt-3 text-sm", variant === "jarvis" ? "text-rose-300" : "text-destructive")}>
          {error}
        </p>
      )}

      {open ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <>
              <button className={cn("rounded-xl px-3 py-2 text-sm font-medium transition", s.ghost)} onClick={() => (setEditing(false), setForm({ subject: view.subject, message: view.message }))} disabled={!!busy}>
                Back
              </button>
              <button className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition", s.primary)} onClick={() => run("save")} disabled={!!busy}>
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save changes
              </button>
            </>
          ) : (
            <>
              <button className={cn("rounded-xl px-3 py-2 text-sm font-medium transition", s.ghost)} onClick={() => run("cancel")} disabled={!!busy}>
                {busy === "cancel" ? <Loader2 className="size-4 animate-spin" /> : "Cancel"}
              </button>
              <button className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition", s.ghost)} onClick={() => setEditing(true)} disabled={!!busy}>
                <Pencil className="size-3.5" /> Edit
              </button>
              <button
                className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50", s.primary)}
                onClick={() => run("send")}
                disabled={!!busy || view.recipient_count === 0}
              >
                {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {busy === "send" ? "Sending…" : `Send to ${people}`}
              </button>
            </>
          )}
        </div>
      ) : (
        <p role="status" className={cn("mt-4 flex items-center gap-1.5 text-sm font-medium", view.status === "sent" ? (variant === "jarvis" ? "text-emerald-300" : "text-success") : s.muted)}>
          {view.status === "sent" ? <Check className="size-4" /> : <X className="size-4" />}
          {result ?? `This email was ${view.status}.`}
        </p>
      )}
    </div>
  );
}
