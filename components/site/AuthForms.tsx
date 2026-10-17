"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { resolvePostAuthPath } from "@/app/actions/auth";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function GoogleButton({ next }: { next: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() =>
        createClient().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        })
      }
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
      </svg>
      Continue with Google
    </Button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));

  const done = async () => {
    // Role is resolved server-side; the client never decides where owners go.
    const dest = await resolvePostAuthPath(params.get("next"));
    router.replace(dest);
    router.refresh();
  };

  const emailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else await done();
  };

  const phoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const formatted = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
    const supabase = createClient();
    if (!otpSent) {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
      setBusy(false);
      if (error) setError(error.message);
      else setOtpSent(true);
      return;
    }
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: "sms" });
    setBusy(false);
    if (error) setError(error.message);
    else await done();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm" role="tablist" aria-label="Login method">
        {(["email", "phone"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md py-1.5 ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>
            {m === "email" ? "Email" : "Phone OTP"}
          </button>
        ))}
      </div>
      {mode === "email" ? (
        <form onSubmit={emailLogin} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/reset-password" className="text-xs text-primary hover:underline">Forgot?</Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Log in
          </Button>
        </form>
      ) : (
        <form onSubmit={phoneLogin} className="space-y-3">
          <div>
            <Label htmlFor="phone">Mobile number</Label>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required value={phone} onChange={(e) => setPhone(e.target.value)} disabled={otpSent} />
          </div>
          {otpSent && (
            <div>
              <Label htmlFor="otp">6-digit code</Label>
              <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {otpSent ? "Verify & log in" : "Send code"}
          </Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="relative text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border">
        <span className="relative bg-background px-2">or</span>
      </div>
      <GoogleButton next={next} />
      <p className="text-center text-sm text-muted-foreground">
        New here? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">Create an account</Link>
      </p>
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name, phone: form.phone || null },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) {
      const dest = await resolvePostAuthPath(params.get("next"));
      router.replace(dest);
      router.refresh();
    } else setCheckEmail(true);
  };

  if (checkEmail) return <p className="rounded-lg bg-muted p-4 text-sm">Check your inbox — we sent a confirmation link to <b>{form.email}</b>.</p>;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="phone">Mobile (optional)</Label>
        <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Create account
      </Button>
      <GoogleButton next={next} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">Log in</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return sent ? (
    <p className="rounded-lg bg-muted p-4 text-sm">If an account exists for {email}, a reset link is on its way.</p>
  ) : (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/update-password` });
        if (error) setError(error.message);
        else setSent(true);
      }}
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full">Send reset link</Button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await createClient().auth.updateUser({ password });
        if (error) setError(error.message);
        else router.replace("/profile");
      }}
    >
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full">Update password</Button>
    </form>
  );
}
