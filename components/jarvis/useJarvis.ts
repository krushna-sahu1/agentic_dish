"use client";

/**
 * Jarvis session: Deepgram Voice Agent over WebSocket (short-lived JWT from
 * /api/jarvis/token), mic streaming, reply playback with barge-in, function
 * calls via /api/jarvis/tools, Confirm-gated writes and a 2-minute silence timeout.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangePreview } from "@/lib/agents/owner/changes";
import { toolToPanel, type PanelSpec } from "@/lib/jarvis/panels";
import type { EmailDraftView } from "@/lib/bulk-email/schema";
import type { EmailOutcome } from "@/components/owner/EmailDraftCard";
import { MicCapture, PcmPlayer } from "./audio";

export type JarvisStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";
export type JarvisError = { kind: "mic" | "connection" | "config" | "auth"; message: string };
export interface Caption {
  id: string;
  role: "user" | "assistant";
  text: string;
}
export type ConfirmState = "pending" | "running" | "done" | "cancelled" | "error";
export type Panel =
  | { id: string; type: "data"; tool: string; spec: PanelSpec }
  | { id: string; type: "confirm"; tool: string; args: unknown; preview: ChangePreview; state: ConfirmState; message?: string }
  | { id: string; type: "email"; draft: EmailDraftView; done: boolean };

type ServerMsg = { type: string; [k: string]: unknown };
type FnCall = { id: string; name: string; arguments: string; client_side?: boolean };

const SILENCE_MS = 120_000;
const KEEPALIVE_MS = 5_000;
const MAX_CAPTIONS = 6;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

interface Session {
  ws: WebSocket | null;
  ctx: AudioContext | null;
  mic: MicCapture | null;
  player: PcmPlayer | null;
  ready: boolean;
  closing: boolean;
  agentSpeaking: boolean;
  lastActivity: number;
  timers: ReturnType<typeof setInterval>[];
  cancelled: Set<string>;
  /** Line waiting for Jarvis to finish talking before it's injected. */
  queuedInject: string | null;
  lastInject: string | null;
  injectRetried: boolean;
}

const fresh = (): Session => ({
  ws: null,
  ctx: null,
  mic: null,
  player: null,
  ready: false,
  closing: false,
  agentSpeaking: false,
  lastActivity: Date.now(),
  timers: [],
  cancelled: new Set(),
  queuedInject: null,
  lastInject: null,
  injectRetried: false,
});

const touch = (cur: Session) => (cur.lastActivity = Date.now());

function send(cur: Session, msg: unknown) {
  if (cur.ws?.readyState === WebSocket.OPEN) cur.ws.send(JSON.stringify(msg));
}

function sendInject(cur: Session, message: string) {
  cur.lastInject = message;
  cur.queuedInject = null;
  send(cur, { type: "InjectAgentMessage", message });
}

function flushQueuedInject(cur: Session) {
  if (cur.queuedInject && !cur.agentSpeaking && !cur.player?.playing) sendInject(cur, cur.queuedInject);
}

export function useJarvis() {
  const [status, setStatus] = useState<JarvisStatus>("idle");
  const [error, setError] = useState<JarvisError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [muted, setMuted] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [dataTick, setDataTick] = useState(0);
  const s = useRef<Session>(fresh());

  /** Live 0..1 audio levels for the orb (read every frame, no re-render). */
  const levels = useCallback(() => ({ mic: s.current.mic?.level() ?? 0, out: s.current.player?.level() ?? 0 }), []);

  const addCaption = (role: Caption["role"], text: string) =>
    setCaptions((c) => [...c, { id: uid(), role, text }].slice(-MAX_CAPTIONS));

  const teardown = useCallback(() => {
    const cur = s.current;
    cur.closing = true;
    cur.timers.forEach(clearInterval);
    cur.mic?.stop();
    cur.player?.flush();
    if (cur.ws && cur.ws.readyState <= WebSocket.OPEN) cur.ws.close();
    void cur.ctx?.close().catch(() => undefined);
    s.current = { ...fresh(), closing: true };
    setStatus("idle");
    setStartedAt(null);
  }, []);

  const end = useCallback(
    (reason?: string) => {
      teardown();
      if (reason) setNotice(reason);
    },
    [teardown],
  );

  /** Speak a fixed line (e.g. "Done") — waits until Jarvis isn't mid-sentence. */
  const inject = useCallback((message: string) => {
    const cur = s.current;
    if (!cur.ws || cur.ws.readyState !== WebSocket.OPEN) return;
    cur.injectRetried = false;
    if (cur.agentSpeaking || cur.player?.playing) cur.queuedInject = message;
    else sendInject(cur, message);
  }, []);

  const handleFunction = useCallback(async (fn: FnCall) => {
    touch(s.current);
    let body: { kind?: string; ok?: boolean; content?: string; data?: unknown; preview?: ChangePreview; args?: unknown; error?: string };
    try {
      const res = await fetch("/api/jarvis/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fn.name, args: fn.arguments, mode: "call" }),
      });
      body = await res.json();
      if (!res.ok) body = { ok: false, content: JSON.stringify({ error: body.error ?? "Tool failed." }) };
    } catch {
      body = { ok: false, content: JSON.stringify({ error: "Couldn't reach the server." }) };
    }
    if (s.current.cancelled.has(fn.id)) return;
    send(s.current, { type: "FunctionCallResponse", id: fn.id, name: fn.name, content: body.content ?? JSON.stringify({ error: "No result." }) });

    if (fn.name === "draft_email" && body.ok && body.data) {
      // One card per draft: a revision replaces the previous version's card.
      const draft = body.data as EmailDraftView;
      setPanels((p) => [{ id: `email-${draft.draft_id}-${draft.version}`, type: "email" as const, draft, done: false }, ...p.filter((x) => !(x.type === "email" && x.draft.draft_id === draft.draft_id))]);
    } else if (body.kind === "read" && body.ok) {
      const spec = toolToPanel(fn.name, body.data);
      if (spec) setPanels((p) => [{ id: uid(), type: "data" as const, tool: fn.name, spec }, ...p.filter((x) => !(x.type === "data" && x.tool === fn.name))].slice(0, 6));
    } else if (body.kind === "confirm" && body.ok && body.preview) {
      const preview = body.preview;
      setPanels((p) => [{ id: uid(), type: "confirm" as const, tool: fn.name, args: body.args, preview, state: "pending" as const }, ...p]);
    }
  }, []);

  const onMessage = useCallback(
    (msg: ServerMsg) => {
      const cur = s.current;
      switch (msg.type) {
        case "SettingsApplied":
          cur.ready = true;
          touch(s.current);
          setStartedAt(Date.now());
          setStatus("listening");
          break;
        case "UserStartedSpeaking":
          // Barge-in: stop Jarvis mid-sentence and listen.
          cur.player?.flush();
          cur.agentSpeaking = false;
          touch(s.current);
          setStatus("listening");
          break;
        case "ConversationText": {
          const text = String(msg.content ?? "").trim();
          if (!text) break;
          touch(s.current);
          if (msg.role === "user") {
            addCaption("user", text);
            // New question: earlier answers fade out; pending confirmations stay.
            setPanels((p) => p.filter((x) => (x.type === "confirm" && (x.state === "pending" || x.state === "running")) || (x.type === "email" && !x.done)));
            setStatus("thinking");
          } else {
            addCaption("assistant", text);
          }
          break;
        }
        case "AgentThinking":
          setStatus("thinking");
          break;
        case "FunctionCallRequest":
          setStatus("thinking");
          for (const fn of (msg.functions as FnCall[]) ?? []) if (fn.client_side !== false) void handleFunction(fn);
          break;
        case "FunctionCallCancelled":
          for (const fn of (msg.functions as { id: string }[]) ?? []) cur.cancelled.add(fn.id);
          break;
        case "AgentStartedSpeaking": {
          cur.agentSpeaking = true;
          const t = Number(msg.total_latency);
          if (Number.isFinite(t) && t > 0) setLatencyMs(Math.round(t < 60 ? t * 1000 : t));
          setStatus("speaking");
          break;
        }
        case "LatencyReport": {
          const t = Number(msg.total_latency);
          if (Number.isFinite(t) && t > 0) setLatencyMs(Math.round(t < 60 ? t * 1000 : t));
          break;
        }
        case "AgentAudioDone":
          cur.agentSpeaking = false;
          if (!cur.player?.playing) {
            setStatus("listening");
            flushQueuedInject(cur);
          }
          break;
        case "InjectionRefused":
          // Someone was talking; try once more when the floor is free.
          if (!cur.injectRetried && cur.lastInject) {
            cur.injectRetried = true;
            cur.queuedInject = cur.lastInject;
            setTimeout(() => flushQueuedInject(cur), 1500);
          }
          break;
        case "Error":
          console.error("[jarvis]", msg);
          setNotice(String(msg.description ?? "Jarvis hit an error."));
          break;
        case "Warning":
          console.warn("[jarvis]", msg);
          break;
      }
    },
    [handleFunction],
  );

  const start = useCallback(async () => {
    if (s.current.ws || status === "connecting") return;
    setError(null);
    setNotice(null);
    setCaptions([]);
    setStatus("connecting");
    const cur = fresh();
    s.current = cur;

    // Created inside the tap so autoplay policies allow playback.
    const ctx = new AudioContext();
    void ctx.resume();
    cur.ctx = ctx;
    const player = new PcmPlayer(ctx);
    player.onDrained = () => {
      if (s.current !== cur || cur.agentSpeaking) return;
      setStatus((st) => (st === "speaking" ? "listening" : st));
      flushQueuedInject(cur);
    };
    cur.player = player;
    const mic = new MicCapture(ctx, (pcm) => {
      if (cur.ready && cur.ws?.readyState === WebSocket.OPEN) cur.ws.send(pcm);
    });
    mic.muted = muted;
    cur.mic = mic;

    const fail = (e: JarvisError) => {
      teardown();
      setError(e);
    };

    try {
      await mic.start();
    } catch (e) {
      const denied = (e as DOMException)?.name === "NotAllowedError" || (e as DOMException)?.name === "SecurityError";
      return fail({
        kind: "mic",
        message: denied
          ? "Jarvis needs your microphone. Allow mic access from the icon in your browser's address bar, then reconnect."
          : "Couldn't find a working microphone. Check it's plugged in, then reconnect.",
      });
    }

    let session: { url: string; token: string; settings: unknown };
    try {
      const res = await fetch("/api/jarvis/token", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return fail({ kind: res.status === 401 || res.status === 403 ? "auth" : res.status === 503 ? "config" : "connection", message: body.error ?? "Couldn't start Jarvis." });
      }
      session = body;
    } catch {
      return fail({ kind: "connection", message: "You seem to be offline. Check your connection and reconnect." });
    }
    if (s.current !== cur) return; // ended while connecting

    const ws = new WebSocket(session.url, ["bearer", session.token]);
    ws.binaryType = "arraybuffer";
    cur.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(session.settings));
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        try {
          onMessage(JSON.parse(ev.data) as ServerMsg);
        } catch {
          /* ignore malformed frames */
        }
        return;
      }
      if (cur.player && !cur.closing) {
        cur.agentSpeaking = true;
        cur.player.enqueue(ev.data as ArrayBuffer);
        touch(cur);
        setStatus("speaking");
      }
    };
    ws.onclose = (ev) => {
      if (cur.closing || s.current !== cur) return;
      fail({ kind: "connection", message: ev.code === 1008 || ev.code === 4001 ? "The voice service rejected the session. Reconnect to try again." : "Lost connection to Jarvis." });
    };

    cur.timers.push(
      setInterval(() => {
        if (cur.mic?.muted) send(cur, { type: "KeepAlive" });
      }, KEEPALIVE_MS),
      setInterval(() => {
        if (cur.ready && !cur.player?.playing && Date.now() - cur.lastActivity > SILENCE_MS) end("Session ended after 2 minutes of silence. Tap the orb to start again.");
      }, 5_000),
    );
  }, [end, muted, onMessage, status, teardown]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (s.current.mic) s.current.mic.muted = !m;
      return !m;
    });
  }, []);

  const resolveConfirm = useCallback(
    async (id: string, mode: "execute" | "reject") => {
      const panel = panels.find((p): p is Extract<Panel, { type: "confirm" }> => p.id === id && p.type === "confirm");
      if (!panel || panel.state !== "pending") return;
      touch(s.current);
      const set = (patch: Partial<Extract<Panel, { type: "confirm" }>>) => setPanels((p) => p.map((x) => (x.id === id && x.type === "confirm" ? { ...x, ...patch } : x)));
      set({ state: "running" });
      try {
        const res = await fetch("/api/jarvis/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: panel.tool, args: panel.args, mode }),
        });
        const body = (await res.json()) as { ok?: boolean; message?: string; error?: string };
        if (mode === "reject") {
          set({ state: "cancelled", message: "Cancelled — nothing changed." });
          inject("Okay, cancelled. Nothing changed.");
        } else if (body.ok) {
          set({ state: "done", message: body.message });
          inject(`Done, boss. ${body.message ?? ""}`.trim());
          setDataTick((t) => t + 1);
        } else {
          set({ state: "error", message: body.error ?? "That didn't go through." });
          inject(`That didn't go through. ${body.error ?? ""}`.trim());
        }
      } catch {
        set({ state: "error", message: "Couldn't reach the server." });
      }
      if (mode === "reject") setTimeout(() => setPanels((p) => p.filter((x) => x.id !== id)), 2500);
    },
    [inject, panels],
  );

  /** The owner tapped Send/Cancel on an email card: Jarvis says what happened. */
  const emailOutcome = useCallback(
    (id: string, o: EmailOutcome) => {
      touch(s.current);
      setPanels((p) => p.map((x) => (x.id === id && x.type === "email" ? { ...x, done: true } : x)));
      if (o.status === "sent") {
        inject(`Sent to ${o.sent === 1 ? "one person" : `${o.sent} people`}, boss.${o.failed ? ` ${o.failed} didn't go through.` : ""}`);
        setDataTick((t) => t + 1);
      } else if (o.status === "cancelled") inject("Okay, cancelled. Nothing was sent.");
      else inject("That email didn't go out. Check the card for details.");
    },
    [inject],
  );

  const dismiss = useCallback((id: string) => setPanels((p) => p.filter((x) => x.id !== id)), []);

  useEffect(() => () => teardown(), [teardown]);

  return {
    status,
    active: status !== "idle",
    error,
    notice,
    captions,
    panels,
    muted,
    latencyMs,
    startedAt,
    dataTick,
    levels,
    start,
    end,
    toggleMute,
    confirm: (id: string) => resolveConfirm(id, "execute"),
    cancel: (id: string) => resolveConfirm(id, "reject"),
    dismiss,
    emailOutcome,
  };
}
