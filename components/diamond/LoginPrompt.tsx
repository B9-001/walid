"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const DISMISSED_KEY = "dt_login_dismissed";
type Step = "signin" | "signup" | "recover";

export default function LoginPrompt() {
  const pathname = usePathname();
  const { user, loading, loginOpen, loginStep, closeLogin, openLogin, signIn, signUp, lookupCustomer, resetPassword } = useAuth();

  const [step, setStep] = useState<Step>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [existingAcct, setExistingAcct] = useState(false); // email already has an account
  const [recoverSent, setRecoverSent] = useState(false);

  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    if (loading || user || isAdmin) return;
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;
    const t = setTimeout(() => openLogin(), 5000);
    return () => clearTimeout(t);
  }, [loading, user, isAdmin, openLogin]);

  // Open on the requested tab (e.g. "Sign up" from the first-order-discount CTAs)
  useEffect(() => {
    if (loginOpen) setStep(loginStep);
  }, [loginOpen, loginStep]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    closeLogin();
    reset();
  };

  const reset = () => {
    setStep("signin"); setName(""); setEmail(""); setPassword("");
    setError(""); setExistingAcct(false); setRecoverSent(false);
  };

  const goStep = (s: Step) => { setStep(s); setError(""); setExistingAcct(false); };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSubmitting(true);
    const err = await signIn(email, password);
    if (err) setError(err); else dismiss();
    setSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    setError(""); setExistingAcct(false); setSubmitting(true);

    // Recognise returning emails before we try to create the account
    const info = await lookupCustomer(email);
    if (info.hasAccount) { setExistingAcct(true); setSubmitting(false); return; }

    const res = await signUp(name.trim(), email, password);
    if (res.alreadyRegistered) { setExistingAcct(true); setSubmitting(false); return; }
    if (res.error) { setError(res.error); setSubmitting(false); return; }
    // Instant signup — they're logged in, no OTP. Close the modal.
    setSubmitting(false); dismiss();
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    setError(""); setSubmitting(true);
    const err = await resetPassword(email);
    setSubmitting(false);
    if (err) setError(err); else setRecoverSent(true);
  };

  const visible = loginOpen && !user && !isAdmin;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={dismiss} className="absolute inset-0 bg-brand-dark/50 backdrop-blur-md" />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-[400px] bg-brand-cream rounded-[28px] shadow-[0_32px_80px_rgba(43,23,34,0.22)] overflow-hidden"
          >
            <button onClick={dismiss} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-brand-light/80 text-brand-dark/40 hover:text-brand-primary hover:bg-brand-blush transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Header band */}
            <div className="bg-brand-dark px-8 pt-8 pb-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 shrink-0">
                  <img src="/logo.jpg" alt="Diamond Taste" className="w-full h-full object-cover" />
                </div>
                <span className="font-display text-lg text-white leading-none">
                  Diamond <span className="italic text-brand-primary">Taste</span>
                </span>
              </div>
              {step === "recover" ? (
                <>
                  <h2 className="font-display text-2xl text-white leading-tight">Reset password</h2>
                  <p className="font-sans text-[13px] text-white/50 mt-1.5">We&apos;ll email you a link to set a new one.</p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl text-white leading-tight">{step === "signin" ? "Welcome back" : "Create an account"}</h2>
                  <p className="font-sans text-[13px] text-white/50 mt-1.5">{step === "signin" ? "Sign in to your account below." : "Save your details for faster ordering."}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-brand-primary/20 text-brand-primary rounded-full px-3 py-1.5">
                    <span>🎁</span>
                    <span className="font-sans text-[11px] font-bold tracking-wide">10% off your first order</span>
                  </div>
                </>
              )}
            </div>

            {/* Body */}
            <div className="px-8 py-7">
              {(step === "signin" || step === "signup") && !existingAcct && (
                <div className="flex bg-brand-paper rounded-full p-1 mb-6">
                  {(["signin", "signup"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => goStep(m)}
                      className={`flex-1 py-2 rounded-full font-sans text-[10px] font-bold tracking-[0.16em] uppercase transition-all ${step === m ? "bg-brand-light shadow-sm text-brand-primary" : "text-brand-dark/35 hover:text-brand-dark"}`}>
                      {m === "signin" ? "Sign In" : "Sign Up"}
                    </button>
                  ))}
                </div>
              )}

              {/* Existing-account notice */}
              {existingAcct ? (
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-blush mb-4">
                    <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="font-display text-xl text-brand-dark">You already have an account</h3>
                  <p className="font-sans text-sm text-brand-grey mt-2">An account for <span className="font-semibold text-brand-dark">{email}</span> already exists. Sign in, or reset your password if you&apos;ve forgotten it.</p>
                  <div className="flex flex-col gap-2.5 mt-6">
                    <button onClick={() => { setStep("signin"); setExistingAcct(false); setPassword(""); setError(""); }}
                      className="w-full bg-brand-dark text-white py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary transition-all">
                      Sign in instead
                    </button>
                    <button onClick={() => { setStep("recover"); setExistingAcct(false); setError(""); }}
                      className="w-full text-brand-dark/45 hover:text-brand-primary transition-colors font-sans text-[11px] tracking-[0.14em] uppercase">
                      Reset my password
                    </button>
                  </div>
                </div>
              ) : step === "recover" ? (
                recoverSent ? (
                  <div className="text-center py-2">
                    <p className="font-sans text-sm text-green-700 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">Check your email for a link to reset your password.</p>
                    <button onClick={() => goStep("signin")} className="mt-4 font-sans text-[11px] text-brand-primary underline tracking-wide">Back to sign in</button>
                  </div>
                ) : (
                  <form onSubmit={handleRecover} className="space-y-3">
                    <Field type="email" value={email} onChange={setEmail} placeholder="Email address" />
                    {error && <p className="text-[12px] text-brand-primary font-medium">{error}</p>}
                    <button type="submit" disabled={submitting} className="w-full bg-brand-dark text-white py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary transition-all disabled:opacity-50 mt-1">
                      {submitting ? "Sending…" : "Send reset link"}
                    </button>
                    <button type="button" onClick={() => goStep("signin")} className="w-full text-center font-sans text-[11px] text-brand-dark/35 hover:text-brand-primary transition-colors tracking-widest uppercase">← Back</button>
                  </form>
                )
              ) : step === "signin" ? (
                <form onSubmit={handleSignIn} className="space-y-3">
                  <Field type="email" value={email} onChange={setEmail} placeholder="Email address" />
                  <Field type="password" value={password} onChange={setPassword} placeholder="Password" />
                  {error && <p className="text-[12px] text-brand-primary font-medium">{error}</p>}
                  <Btn loading={submitting} label="Sign In" loadingLabel="Signing in…" />
                  <button type="button" onClick={() => goStep("recover")} className="w-full text-center font-sans text-[11px] text-brand-dark/40 hover:text-brand-primary transition-colors pt-1">Forgot password?</button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-3">
                  <Field value={name} onChange={setName} placeholder="Full name" />
                  <Field type="email" value={email} onChange={setEmail} placeholder="Email address" />
                  <Field type="password" value={password} onChange={setPassword} placeholder="Password (min. 6 characters)" minLength={6} />
                  {error && <p className="text-[12px] text-brand-primary font-medium">{error}</p>}
                  <Btn loading={submitting} label="Create Account" loadingLabel="Creating account…" />
                </form>
              )}

              {(step === "signin" || step === "signup") && !existingAcct && (
                <button onClick={dismiss} className="w-full mt-4 py-2 font-sans text-[11px] text-brand-dark/30 hover:text-brand-primary transition-colors tracking-[0.14em] uppercase">
                  Continue as guest
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({ type = "text", value, onChange, placeholder, minLength }: {
  type?: string; value: string; onChange: (v: string) => void; placeholder: string; minLength?: number;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required minLength={minLength}
      className="w-full bg-brand-light border border-brand-line rounded-2xl px-4 py-3 text-sm text-brand-dark placeholder:text-brand-dark/30 focus:outline-none focus:border-brand-primary transition-colors" />
  );
}

function Btn({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full bg-brand-dark text-white py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary transition-all disabled:opacity-50 mt-1">
      {loading ? loadingLabel : label}
    </button>
  );
}
