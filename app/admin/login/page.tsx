"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Only accounts on the admin allowlist may enter the admin
    const { data: admin } = await supabase
      .from("diamond_admins")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!admin) {
      await supabase.auth.signOut();
      setError("This account doesn't have admin access.");
      setLoading(false);
      return;
    }

    window.location.href = "/admin";
  }

  return (
    <div className="min-h-screen bg-brand-paper flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center text-center mb-11">
          <div className="rounded-full overflow-hidden h-16 w-16 bg-brand-light border border-brand-line shadow-sm">
            <img src="/logo.jpg" alt="thepufflette.co" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-3xl text-brand-dark leading-none mt-5">
            thepufflette<span className="italic text-brand-primary">.co</span>
          </span>
          <span className="eyebrow mt-3">Admin Studio</span>
        </div>

        <div className="bg-brand-light border border-brand-line rounded-3xl p-7 shadow-[0_22px_48px_rgba(28,22,19,0.06)]">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] label-track text-brand-dark/50 mb-2.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3.5 text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] label-track text-brand-dark/50 mb-2.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3.5 text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>

            {error && (
              <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl px-4 py-3 text-brand-primary text-[11px] font-medium text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary text-brand-light py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.3em] uppercase hover:bg-brand-primary-dark transition-colors disabled:opacity-40"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-brand-dark/25 text-[9px] tracking-widest uppercase mt-9 font-semibold">
          thepufflette.co © {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
