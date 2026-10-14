"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ImagePlus, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { ChangePreview } from "@/lib/agents/owner/changes";
import { cn } from "@/lib/utils";
import { CardShell, ErrorNote } from "./shared";

type ActionRes<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

export interface ConfirmCardProps {
  args: Record<string, unknown>;
  status: "inProgress" | "executing" | "complete";
  result?: string;
  respond?: (r: unknown) => Promise<void>;
  preview: (args: Record<string, unknown>) => Promise<ActionRes<ChangePreview & { alternatives?: string[] }>>;
  execute: (args: Record<string, unknown>) => Promise<ActionRes<{ message: string; data?: unknown }>>;
  reject: (args: Record<string, unknown>) => Promise<unknown>;
  upload?: (form: FormData) => Promise<ActionRes<{ url: string }>>;
  onDone?: () => void;
  confirmLabel?: string;
}

/**
 * Human-in-the-loop confirm card (before → after diff). The change is applied
 * ONLY by the Confirm button's server action — never by the model. The result
 * is then reported back to the agent via respond().
 */
export function ConfirmCard({ args: rawArgs, status, result, respond, preview, execute, reject, upload, onDone, confirmLabel = "Confirm" }: ConfirmCardProps) {
  const [args, setArgs] = useState<Record<string, unknown>>(rawArgs);
  const [p, setP] = useState<(ChangePreview & { alternatives?: string[] }) | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ kind: "confirmed" | "rejected" | "error"; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const fetched = useRef<string>("");

  // Load (or reload after edits) the server-computed preview.
  useEffect(() => {
    if (status !== "executing") return;
    const key = JSON.stringify(args);
    if (fetched.current === key) return;
    fetched.current = key;
    setLoadErr(null);
    preview(args).then((r) => (r.ok ? setP(r.data) : setLoadErr(r.error)));
  }, [args, status, preview]);

  useEffect(() => setArgs(rawArgs), [rawArgs]);

  if (status === "inProgress") return <CardShell><p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Preparing…</p></CardShell>;

  const final = outcome ?? (status === "complete" ? parseOutcome(result) : null);
  if (final) {
    return (
      <div className={cn("my-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", final.kind === "confirmed" ? "border-success/40 bg-success/5" : final.kind === "error" ? "border-destructive/40 bg-destructive/5" : "bg-muted/50")}>
        {final.kind === "confirmed" ? <Check className="mt-0.5 size-4 text-success" /> : <X className="mt-0.5 size-4 text-muted-foreground" />}
        <span>{final.message}</span>
      </div>
    );
  }

  const finish = async (o: { kind: "confirmed" | "rejected" | "error"; message: string }, payload: unknown) => {
    setOutcome(o);
    await respond?.(payload);
    onDone?.();
  };

  const onConfirm = async () => {
    setBusy(true);
    const r = await execute(args);
    setBusy(false);
    if (r.ok) await finish({ kind: "confirmed", message: r.data.message }, { status: "confirmed", confirmed_by_user: true, message: r.data.message, final_args: args });
    else if (r.code === "login_required") await finish({ kind: "error", message: r.error }, { status: "login_required", error: r.error });
    else setLoadErr(r.error);
  };

  const onCancel = async () => {
    setBusy(true);
    await reject(args);
    setBusy(false);
    await finish({ kind: "rejected", message: "Cancelled — nothing was changed." }, { status: "rejected_by_user", message: "The user cancelled. Nothing was changed." });
  };

  const blocking = (p?.warnings ?? []).some((w) => /can't|cannot|never|nothing to|already|isn't|not available|closed at|fully booked|largest table/i.test(w));

  return (
    <CardShell
      className={cn(p?.destructive && "border-destructive/40")}
      title={p?.title ?? "Please confirm"}
      footer={
        <>
          <Button size="sm" variant={p?.destructive ? "destructive" : "default"} disabled={!p || busy || blocking} onClick={onConfirm} data-testid="confirm-button">
            {busy ? <Loader2 className="animate-spin" /> : <Check />} {confirmLabel}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onCancel} data-testid="cancel-button">
            <X /> Cancel
          </Button>
          {p?.editable?.length ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              <Pencil /> Edit
            </Button>
          ) : null}
        </>
      }
    >
      {!p && !loadErr && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking…</p>}
      {loadErr && <ErrorNote message={loadErr} />}
      {p && (
        <div className="space-y-3 text-sm">
          {p.description && <p className="text-muted-foreground">{p.description}</p>}
          {p.changes.length > 0 && (
            <ul className="space-y-1.5">
              {p.changes.map((c, i) => (
                <li key={i} className="grid grid-cols-[minmax(6rem,auto)_1fr] items-start gap-2">
                  <span className="capitalize text-muted-foreground">{c.label}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {c.before != null && <span className="rounded bg-muted px-1.5 py-0.5 line-through decoration-muted-foreground/60">{c.before}</span>}
                    {c.before != null && c.after != null && <ArrowRight className="size-3.5 text-muted-foreground" aria-label="becomes" />}
                    {c.after != null && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium">{c.after}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p.table && (
            <div className="max-h-56 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>{p.table.columns.map((c) => <th key={c} className="px-2 py-1.5 text-left font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {p.table.rows.map((r, i) => (
                    <tr key={i} className="border-t">{r.map((v, j) => <td key={j} className="px-2 py-1">{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editing && p.editable && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-2">
              {p.editable.map((f) => (
                <label key={f.field} className="block text-xs">
                  <span className="mb-1 block text-muted-foreground">{f.label}</span>
                  {f.type === "textarea" ? (
                    <Textarea defaultValue={String(args[f.field] ?? f.value ?? "")} onBlur={(e) => setArgs({ ...args, [f.field]: e.target.value })} />
                  ) : (
                    <Input type={f.type === "number" ? "number" : "text"} defaultValue={String(args[f.field] ?? f.value ?? "")} onBlur={(e) => setArgs({ ...args, [f.field]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
                  )}
                </label>
              ))}
            </div>
          )}
          {p.allow_image_upload && upload && <ImageUpload upload={upload} onUploaded={(url) => setArgs({ ...args, image_url: url })} current={args.image_url as string | undefined} />}
          {(p.warnings ?? []).map((w, i) => (
            <p key={i} className="flex gap-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
            </p>
          ))}
          {p.alternatives?.length ? (
            <div>
              <p className="mb-1 text-muted-foreground">Available instead:</p>
              <div className="flex flex-wrap gap-1.5">
                {p.alternatives.map((t) => (
                  <Button key={t} size="sm" variant="outline" onClick={() => setArgs({ ...args, datetime: t })}>
                    {new Date(t).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit" })}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </CardShell>
  );
}

function ImageUpload({ upload, onUploaded, current }: { upload: NonNullable<ConfirmCardProps["upload"]>; onUploaded: (url: string) => void; current?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {current && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="New dish photo" className="size-12 rounded-md object-cover" />
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-accent">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {current ? "Replace photo" : "Upload photo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setErr(null);
            const fd = new FormData();
            fd.append("file", f);
            const r = await upload(fd);
            setBusy(false);
            if (r.ok) onUploaded(r.data.url);
            else setErr(r.error);
          }}
        />
      </label>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}

function parseOutcome(result?: string): { kind: "confirmed" | "rejected" | "error"; message: string } | null {
  if (!result) return null;
  try {
    const r = JSON.parse(result) as { status?: string; message?: string; error?: string };
    if (r.status === "confirmed") return { kind: "confirmed", message: r.message ?? "Done." };
    if (r.status === "rejected_by_user") return { kind: "rejected", message: "Cancelled — nothing was changed." };
    return { kind: "error", message: r.error ?? r.message ?? "Not completed." };
  } catch {
    return { kind: "confirmed", message: result };
  }
}
