"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function ReferProgram() {
  const { user, loading, openLogin } = useAuth();
  const [code, setCode] = useState("");
  const [count, setCount] = useState(0);
  const [goal, setGoal] = useState(3);
  const [rewardCode, setRewardCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setBusy(false); return; }
    (async () => {
      const [{ data: me }, { data: qualified }, { data: reward }, { data: tmpl }] = await Promise.all([
        supabase.from("diamond_customers").select("referral_code").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("diamond_referral_progress", { p_referrer: user.id }),
        supabase.from("diamond_coupons").select("code").eq("owner_user_id", user.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1),
        supabase.from("diamond_coupons").select("referral_goal").eq("is_referral_reward", true).eq("is_active", true).limit(1),
      ]);
      setCode(me?.referral_code || "");
      setCount(typeof qualified === "number" ? qualified : 0);
      setGoal(tmpl?.[0]?.referral_goal || 3);
      setRewardCode(reward?.[0]?.code || null);
      setBusy(false);
    })();
  }, [user, loading]);

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/?ref=${code}` : "";

  const share = async () => {
    if (!link) return;
    const shareData = {
      title: "Diamond Taste",
      text: "I love Diamond Taste 🍰 order sweet treats with my link!",
      url: link,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-[640px] mx-auto px-6 py-16 md:py-24">
      <div className="text-center mb-10">
        <span className="eyebrow">Refer &amp; earn</span>
        <h1 className="font-display text-4xl md:text-6xl text-brand-dark mt-3">
          Give cake, get <span className="font-script text-brand-primary font-normal">cake</span>
        </h1>
        <p className="font-sans text-sm md:text-base text-brand-dark/60 mt-4 max-w-md mx-auto">
          Share your link with friends. When <span className="font-semibold text-brand-dark">3 of them place an order</span>, you get a <span className="font-semibold text-brand-primary">free milk cake</span> 🍰
        </p>
      </div>

      {busy ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : !user ? (
        <div className="bg-brand-light border border-brand-line rounded-3xl p-8 text-center">
          <p className="font-sans text-sm text-brand-dark/70 mb-5">Sign in to get your personal referral link.</p>
          <button onClick={() => openLogin()} className="bg-brand-primary text-brand-light px-8 py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all">
            Sign in
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progress */}
          <div className="bg-brand-light border border-brand-line rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="font-sans text-[11px] tracking-widest uppercase text-brand-dark/50">Your progress</span>
              <span className="font-display text-xl text-brand-primary">{Math.min(count, goal)} / {goal}</span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: goal }).map((_, i) => (
                <div key={i} className={`h-2.5 flex-1 rounded-full transition-colors ${i < count ? "bg-brand-primary" : "bg-brand-paper"}`} />
              ))}
            </div>
            <p className="font-sans text-[12px] text-brand-grey mt-3">
              {count >= goal ? "You've hit the goal! 🎉" : `${goal - count} more friend${goal - count !== 1 ? "s" : ""} need to order to unlock your free milk cake.`}
            </p>
          </div>

          {/* Reward earned */}
          {rewardCode && (
            <div className="bg-brand-primary/5 border border-brand-primary/30 rounded-3xl p-6 text-center">
              <p className="font-display text-2xl text-brand-dark">🍰 Free milk cake unlocked!</p>
              <p className="font-sans text-sm text-brand-grey mt-1">Use this code at checkout (it's in your vouchers too):</p>
              <p className="font-display text-3xl text-brand-primary tracking-wide mt-3">{rewardCode}</p>
            </div>
          )}

          {/* Share */}
          <div className="bg-brand-light border border-brand-line rounded-3xl p-6 md:p-8">
            <button
              onClick={share}
              className="w-full flex items-center justify-center gap-2.5 bg-brand-primary text-brand-light py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share my link
            </button>

            <div className="flex items-center gap-2 mt-4">
              <input readOnly value={link} className="flex-1 min-w-0 bg-brand-paper border border-brand-line rounded-xl px-4 py-2.5 text-sm text-brand-dark/70" />
              <button onClick={copyLink} className="shrink-0 px-4 py-2.5 bg-brand-plum text-brand-light rounded-xl font-sans text-[10px] font-bold tracking-widest uppercase hover:bg-brand-plum-dark transition-colors">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
