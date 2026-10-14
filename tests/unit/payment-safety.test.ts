/**
 * PAYMENT SAFETY: prove statically that no agent code can move money in or mark
 * an order paid. Walks the transitive import graph of every file in lib/agents/**.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // package import
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(cand) && statSync(cand).isFile()) return cand;
  return null;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);
  return specs.map((s) => resolveImport(file, s)).filter((x): x is string => !!x);
}

function closure(entries: string[]) {
  const seen = new Map<string, string>(); // file -> importer
  const stack: [string, string][] = entries.map((e) => [e, "(entry)"]);
  while (stack.length) {
    const [f, by] = stack.pop()!;
    if (seen.has(f)) continue;
    seen.set(f, by);
    for (const d of importsOf(f)) stack.push([d, f]);
  }
  return seen;
}

const agentFiles = walk(join(ROOT, "lib/agents"));
const reachable = closure(agentFiles);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

describe("payment safety (static)", () => {
  it("agent code never reaches the webhook / mark-paid code", () => {
    const bad = [...reachable.keys()].filter((f) => rel(f).startsWith("lib/payments/") || rel(f).startsWith("app/api/payments/"));
    expect(bad.map(rel)).toEqual([]);
  });

  it("no reachable module calls the paid/refunded/failed RPCs or a capture API", () => {
    const offenders: string[] = [];
    for (const f of reachable.keys()) {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      if (/mark_order_paid|mark_payment_failed|mark_order_refunded|app\.payment_context/.test(src)) offenders.push(`${rel(f)}: mark-paid RPC`);
      if (/\/capture\b|capturePayment|payments\.capture/.test(src)) offenders.push(`${rel(f)}: capture`);
    }
    expect(offenders).toEqual([]);
  });

  it("lib/razorpay.ts exports no capture/charge function", () => {
    const src = readFileSync(join(ROOT, "lib/razorpay.ts"), "utf8");
    const exported = [...src.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]);
    expect(exported.filter((n) => /capture|charge|^pay(?!ment)/i.test(n))).toEqual([]);
  });

  it("only the issue_refund change can reach refundPayment", () => {
    const users = [...reachable.keys()].filter((f) => /\brefundPayment\b/.test(readFileSync(f, "utf8")));
    expect(users.map(rel).sort()).toEqual(["lib/razorpay.ts", "lib/services/refunds.ts"]);
    const refundImporters = agentFiles.filter((f) => importsOf(f).some((d) => rel(d) === "lib/services/refunds.ts"));
    expect(refundImporters.map(rel)).toEqual(["lib/agents/owner/changes.ts"]);
    const changes = readFileSync(join(ROOT, "lib/agents/owner/changes.ts"), "utf8");
    const calls = [...changes.matchAll(/issueRefund\(/g)].length;
    expect(calls).toBe(1);
    expect(changes.slice(changes.indexOf("issue_refund: define"), changes.indexOf("set_item_availability: define"))).toContain("issueRefund(");
  });

  it("no agent tool is named like a payment action", () => {
    const names = agentFiles.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/name:\s*"(\w+)"/g)].map((m) => m[1]));
    expect(names.filter((n) => /^(pay|charge|capture|confirm_payment|mark_paid)/.test(n))).toEqual([]);
  });

  it("owner write changes can't target payment statuses", () => {
    const src = readFileSync(join(ROOT, "lib/agents/owner/change-schemas.ts"), "utf8");
    const statusEnum = src.match(/const statusEnum = z\.enum\(\[([^\]]+)\]\)/)![1];
    expect(statusEnum).not.toMatch(/paid|refunded|payment_failed|awaiting_payment/);
  });
});
