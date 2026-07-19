"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link establishes a temporary session via the URL.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setSaving(false); return; }
    setDone(true);
    setSaving(false);
    setTimeout(() => router.replace("/"), 2200);
  };

  return (
    <div className="min-h-screen bg-brand-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-9">
          <div className="rounded-full overflow-hidden h-14 w-14 bg-brand-light border border-brand-line">
            <img src="/logo.jpg" alt="Diamond Taste" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-2xl text-brand-dark leading-none mt-4">
            Diamond <span className="italic text-brand-primary">Taste</span>
          </span>
        </div>

        <div className="bg-brand-light border border-brand-line rounded-3xl p-7">
          {done ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-brand-primary text-brand-light flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className="font-display text-2xl text-brand-dark">Password updated</h1>
              <p className="font-sans text-sm text-brand-grey mt-2">Taking you back to the shop…</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-8">
              <div className="w-9 h-9 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-sans text-[12px] text-brand-grey mt-4">Verifying your reset link…</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl text-brand-dark">Set a new password</h1>
                <p className="font-sans text-sm text-brand-grey mt-1">Choose a new password for your account.</p>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
              />
              {error && <p className="font-sans text-[12px] text-brand-primary font-medium">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-brand-primary text-brand-light py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-60"
              >
                {saving ? "Saving…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
