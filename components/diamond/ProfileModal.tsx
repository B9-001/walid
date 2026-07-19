"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function ProfileModal() {
  const { user, profileOpen, closeProfile, signOut } = useAuth();

  const [areas, setAreas] = useState<{ id: string; location: string; fee: number }[]>([]);
  const [form, setForm] = useState({ full_name: "", phone: "", address: "", delivery_area: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profileOpen || !user) return;
    setLoading(true);
    setSaved(false);
    Promise.all([
      supabase.from("diamond_customers").select("full_name, phone, address, delivery_area").eq("user_id", user.id).maybeSingle(),
      supabase.from("diamond_delivery_fees").select("id, location, fee").eq("is_active", true).order("sort_order", { ascending: true }),
    ]).then(([{ data: me }, { data: a }]) => {
      setAreas(a || []);
      setForm({
        full_name: me?.full_name || user.user_metadata?.full_name || "",
        phone: me?.phone || "",
        address: me?.address || "",
        delivery_area: me?.delivery_area || "",
      });
      setLoading(false);
    });
  }, [profileOpen, user]);

  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    await supabase.from("diamond_customers").upsert(
      {
        user_id: user.id,
        email: user.email!.toLowerCase(),
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.delivery_area || null,
        state: "Abuja",
        delivery_area: form.delivery_area || null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const visible = profileOpen && !!user;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeProfile} className="absolute inset-0 bg-brand-dark/50 backdrop-blur-md" />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md bg-brand-cream rounded-[28px] shadow-[0_32px_80px_rgba(28,22,19,0.22)] max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-brand-dark px-7 pt-7 pb-6 shrink-0">
              <button onClick={closeProfile} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="font-display text-2xl text-white leading-tight">My details</h2>
              <p className="font-sans text-[13px] text-white/50 mt-1 truncate">{user?.email}</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><div className="w-9 h-9 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <form onSubmit={handleSave} className="p-7 space-y-4 overflow-y-auto">
                <Field label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} placeholder="Ada Obi" />
                <Field label="Phone" type="tel" value={form.phone} onChange={(v) => set("phone", v)} placeholder="080…" />

                <div>
                  <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">Delivery area</label>
                  <select
                    value={form.delivery_area}
                    onChange={(e) => set("delivery_area", e.target.value)}
                    className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
                  >
                    <option value="">Select your area</option>
                    {areas.map((a) => <option key={a.id} value={a.location}>{a.location}</option>)}
                  </select>
                  <p className="font-sans text-[11px] text-brand-grey mt-2">📍 We currently deliver within Abuja only.</p>
                </div>

                <Field label="Delivery address" value={form.address} onChange={(v) => set("address", v)} placeholder="House number, street, landmark…" />

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-brand-primary text-white py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-60 mt-2"
                >
                  {saving ? "Saving…" : saved ? "✓ Saved" : "Save details"}
                </button>

                <button
                  type="button"
                  onClick={() => { signOut(); closeProfile(); }}
                  className="w-full py-2 font-sans text-[11px] text-brand-dark/40 hover:text-brand-primary transition-colors tracking-[0.14em] uppercase"
                >
                  Sign out
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark placeholder:text-brand-dark/30 focus:outline-none focus:border-brand-primary transition-colors" />
    </div>
  );
}
