"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { attributeReferral } from "@/lib/referral";
import { getSource } from "@/lib/source";
import type { User } from "@supabase/supabase-js";

export type SignUpResult = { error?: string; alreadyRegistered?: boolean };
export type CustomerLookup = { exists: boolean; hasAccount: boolean; name: string | null };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  loginOpen: boolean;
  loginStep: "signin" | "signup";
  openLogin: (step?: "signin" | "signup") => void;
  closeLogin: () => void;
  profileOpen: boolean;
  openProfile: () => void;
  closeProfile: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  lookupCustomer: (email: string) => Promise<CustomerLookup>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  loginOpen: false,
  loginStep: "signin",
  openLogin: () => {},
  closeLogin: () => {},
  profileOpen: false,
  openProfile: () => {},
  closeProfile: () => {},
  signIn: async () => null,
  signUp: async () => ({}),
  lookupCustomer: async () => ({ exists: false, hasAccount: false, name: null }),
  resetPassword: async () => null,
  updatePassword: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginStep, setLoginStep] = useState<"signin" | "signup">("signin");
  const [profileOpen, setProfileOpen] = useState(false);

  // Capture a referral code from the URL (?ref=CODE) so we can attribute the
  // signup once they create an account.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("dt_ref", ref.trim().toUpperCase());
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) return;

      // Don't record admins as customers — keeps the two tables disjoint
      const { data: admin } = await supabase
        .from("diamond_admins")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();
      if (admin) return;

      // Upsert by email: this both creates the account row AND claims any
      // existing guest lead with the same email (sets its user_id).
      const meta = session.user.user_metadata || {};
      const payload: Record<string, unknown> = {
        user_id: session.user.id,
        email: session.user.email!.toLowerCase(),
        last_seen_at: new Date().toISOString(),
      };
      if (meta.full_name || meta.name) payload.full_name = meta.full_name || meta.name;
      if (meta.avatar_url) payload.avatar_url = meta.avatar_url;
      { const src = getSource(); if (src) payload.referral_source = src; }

      const email = session.user.email!.toLowerCase();
      await supabase.from("diamond_customers").upsert(payload, { onConflict: "email" });

      // Attribute the referral (once) if they arrived via someone's link
      await attributeReferral(email, session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : null;
  };

  // Sign-up is instant — no OTP / email confirmation. "Confirm email" is turned OFF
  // in Supabase Auth, so signUp returns a live session and the shopper is logged in
  // right away; onAuthStateChange then syncs them into diamond_customers.
  // (If a session ever isn't returned, we just sign them in with the password set.)
  const signUp = async (name: string, email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      // Some projects return an explicit error for existing users
      if (/already|exists|registered/i.test(error.message)) return { alreadyRegistered: true };
      return { error: error.message };
    }
    // With email-enumeration protection on, an existing user comes back with no identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { alreadyRegistered: true };
    }
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) return { error: signInError.message };
    }
    return {};
  };

  const lookupCustomer = async (email: string): Promise<CustomerLookup> => {
    // Via RPC: direct reads of diamond_customers are restricted to the owner/admin.
    const { data } = await supabase.rpc("diamond_lookup_customer", { p_email: email.trim().toLowerCase() });
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return { exists: false, hasAccount: false, name: null };
    return { exists: true, hasAccount: !!row.has_account, name: row.full_name ?? null };
  };

  const resetPassword = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    return error ? error.message : null;
  };

  const updatePassword = async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? error.message : null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      loginOpen, loginStep,
      openLogin: (step: "signin" | "signup" = "signin") => { setLoginStep(step); setLoginOpen(true); },
      closeLogin: () => setLoginOpen(false),
      profileOpen,
      openProfile: () => setProfileOpen(true),
      closeProfile: () => setProfileOpen(false),
      signIn, signUp, lookupCustomer, resetPassword, updatePassword, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
