"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { formatNaira, errorMessage } from "@/lib/format";
import type { Coupon } from "@/lib/types";

const blank = () => ({
  code: "",
  description: "",
  discount_type: "percentage" as "percentage" | "fixed",
  discount_value: 0,
  min_order_amount: 0, // kobo
  max_discount_amount: 0, // kobo
  usage_limit: 0,
  expiry_date: "",
  is_active: true,
  first_order_only: false,
  is_public: true,
  stackable: true,
  category: "",
  is_referral_reward: false,
  referral_goal: 3,
});

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(blank());

  useEffect(() => {
    fetchCoupons();
    supabase.from("diamond_categories").select("name").order("sort_order").then(({ data }) => {
      if (data) setCategories(data.map((c: { name: string }) => c.name));
    });
  }, []);

  async function fetchCoupons() {
    setLoading(true);
    const { data } = await supabase.from("diamond_coupons").select("*").order("created_at", { ascending: false });
    if (data) setCoupons(data);
    setLoading(false);
  }

  const openAdd = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description || "",
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
      min_order_amount: c.min_order_amount || 0,
      max_discount_amount: c.max_discount_amount || 0,
      usage_limit: c.usage_limit || 0,
      expiry_date: c.expiry_date || "",
      is_active: c.is_active,
      first_order_only: !!c.first_order_only,
      is_public: c.is_public ?? true,
      stackable: c.stackable ?? true,
      category: c.category || "",
      is_referral_reward: !!c.is_referral_reward,
      referral_goal: c.referral_goal || 3,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) return alert("Coupon code is required.");
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_order_amount: form.min_order_amount || 0,
        max_discount_amount: form.max_discount_amount || null,
        usage_limit: form.usage_limit || null,
        expiry_date: form.expiry_date || null,
        is_active: form.is_active,
        first_order_only: form.first_order_only,
        is_public: form.is_public,
        stackable: form.stackable,
        category: form.category || null,
        is_referral_reward: form.is_referral_reward,
        referral_goal: form.is_referral_reward ? (form.referral_goal || 3) : null,
      };
      if (editing) {
        const { error } = await supabase.from("diamond_coupons").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("diamond_coupons").insert([payload]);
        if (error) throw error;
      }
      setOpen(false);
      fetchCoupons();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Coupon) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    await supabase.from("diamond_coupons").delete().eq("id", c.id);
    fetchCoupons();
  };

  const toggleActive = async (c: Coupon) => {
    await supabase.from("diamond_coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    fetchCoupons();
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-brand-line pb-7 mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">Coupons</h1>
          <p className="font-script text-2xl text-brand-primary mt-2">a little something extra</p>
        </div>
        <button onClick={openAdd} className="bg-brand-primary text-brand-light px-7 py-3.5 rounded-full font-sans text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all shrink-0">+ New Coupon</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : coupons.length === 0 ? (
        <div className="py-24 border-2 border-dashed border-brand-line rounded-2xl text-center"><p className="font-display text-2xl text-brand-dark/40">No coupons yet.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {coupons.map((c) => (
            <div key={c.id} className={`bg-brand-light border rounded-2xl p-5 ${c.is_active ? "border-brand-line" : "border-brand-line opacity-50"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-display text-2xl text-brand-primary tracking-wide">{c.code}</span>
                  <p className="font-sans text-xs text-brand-grey mt-0.5">{c.description}</p>
                </div>
                <span className="font-sans text-sm font-bold text-brand-plum">{c.discount_type === "percentage" ? `${c.discount_value}%` : formatNaira(c.discount_value)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-brand-grey">
                {!!c.min_order_amount && c.min_order_amount > 0 && <span>Min {formatNaira(c.min_order_amount)}</span>}
                {c.usage_limit && <span>Used {c.usage_count}/{c.usage_limit}</span>}
                {!c.usage_limit && <span>Used {c.usage_count}×</span>}
                {c.expiry_date && <span>Exp {c.expiry_date}</span>}
              </div>
              {(c.first_order_only || c.is_public === false || c.category || c.is_referral_reward || c.stackable === false) && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {c.is_referral_reward && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-primary text-brand-light">Referral reward · {c.referral_goal || 3}</span>}
                  {c.category && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-paper text-brand-dark/60">{c.category} only</span>}
                  {c.first_order_only && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-blush text-brand-primary">1st order</span>}
                  {c.stackable === false && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-plum text-brand-light">No stacking</span>}
                  {c.is_public === false && !c.is_referral_reward && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-line text-brand-dark/50">Hidden</span>}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => openEdit(c)} className="flex-1 py-2 border border-brand-line rounded-full text-[9px] font-bold tracking-widest uppercase text-brand-dark hover:bg-brand-dark hover:text-brand-light transition-colors">Edit</button>
                <button onClick={() => toggleActive(c)} className="flex-1 py-2 border border-brand-line rounded-full text-[9px] font-bold tracking-widest uppercase text-brand-dark/60 hover:bg-brand-plum hover:text-brand-light transition-colors">{c.is_active ? "Disable" : "Enable"}</button>
                <button onClick={() => handleDelete(c)} className="px-3 py-2 border border-red-200 rounded-full text-red-400 hover:bg-red-500 hover:text-white transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="relative w-full max-w-lg bg-brand-cream rounded-3xl max-h-[90vh] overflow-y-auto">
              <div className="px-7 py-5 flex justify-between items-center border-b border-brand-line sticky top-0 bg-brand-cream z-10">
                <h3 className="font-display text-2xl text-brand-dark">{editing ? "Edit Coupon" : "New Coupon"}</h3>
                <button onClick={() => setOpen(false)} className="text-brand-dark/40 hover:text-brand-primary"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-7 space-y-4">
                <CLabel l="Code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary uppercase" /></CLabel>
                <CLabel l="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary" /></CLabel>
                <div className="grid grid-cols-2 gap-3">
                  <CLabel l="Type">
                    <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percentage" | "fixed" })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed (₦)</option>
                    </select>
                  </CLabel>
                  <CLabel l={form.discount_type === "percentage" ? "Value (%)" : "Value (₦)"}>
                    <input type="number" min="0" value={form.discount_type === "fixed" ? (form.discount_value ? form.discount_value / 100 : "") : (form.discount_value || "")} onChange={(e) => setForm({ ...form, discount_value: form.discount_type === "fixed" ? Math.round(Number(e.target.value) * 100) : Number(e.target.value) })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums" />
                  </CLabel>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <CLabel l="Min order (₦)"><input type="number" min="0" value={form.min_order_amount ? form.min_order_amount / 100 : ""} onChange={(e) => setForm({ ...form, min_order_amount: Math.round(Number(e.target.value) * 100) })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums" /></CLabel>
                  {form.discount_type === "percentage" && <CLabel l="Max discount (₦)"><input type="number" min="0" value={form.max_discount_amount ? form.max_discount_amount / 100 : ""} onChange={(e) => setForm({ ...form, max_discount_amount: Math.round(Number(e.target.value) * 100) })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums" /></CLabel>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <CLabel l="Usage limit (0 = ∞)"><input type="number" min="0" value={form.usage_limit || ""} onChange={(e) => setForm({ ...form, usage_limit: Number(e.target.value) })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums" /></CLabel>
                  <CLabel l="Expiry date"><input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary" /></CLabel>
                </div>
                <CLabel l="Restrict to category (optional)">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary">
                    <option value="">Any item</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </CLabel>
                <div className="space-y-2.5 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-brand-primary" /><span className="text-[11px] font-medium text-brand-dark">Active</span></label>
                  <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={form.first_order_only} onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })} className="w-4 h-4 accent-brand-primary" /><span className="text-[11px] font-medium text-brand-dark">First order only <span className="text-brand-dark/40">(signed-in customers, one-time)</span></span></label>
                  <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="w-4 h-4 accent-brand-primary" /><span className="text-[11px] font-medium text-brand-dark">Show in cart voucher list <span className="text-brand-dark/40">(public)</span></span></label>
                  <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} className="w-4 h-4 accent-brand-primary" /><span className="text-[11px] font-medium text-brand-dark">Can be combined with other vouchers <span className="text-brand-dark/40">(uncheck to use alone)</span></span></label>
                  <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={form.is_referral_reward} onChange={(e) => setForm({ ...form, is_referral_reward: e.target.checked })} className="w-4 h-4 accent-brand-primary" /><span className="text-[11px] font-medium text-brand-dark">Use as the referral reward <span className="text-brand-dark/40">(given when goal is met)</span></span></label>
                </div>
                {form.is_referral_reward && (
                  <div className="bg-brand-blush/40 border border-brand-primary/20 rounded-xl p-3.5 space-y-2">
                    <CLabel l="Referrals required (paid orders)">
                      <input type="number" min="1" value={form.referral_goal || ""} onChange={(e) => setForm({ ...form, referral_goal: Number(e.target.value) })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums" />
                    </CLabel>
                    <p className="text-[10px] text-brand-dark/50 leading-relaxed">This coupon is the template: a personal copy is auto-issued to a customer once {form.referral_goal || 3} referred friends have placed a paid order. Set the discount + category above to control what they win (e.g. 100% off · Gourmet Puff Puff = free puff puff). The template itself can&apos;t be redeemed directly.</p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setOpen(false)} className="flex-1 py-3.5 border border-brand-line rounded-full text-[10px] font-bold tracking-widest uppercase text-brand-dark">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-3.5 bg-brand-primary text-brand-light rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-50">{saving ? "Saving…" : editing ? "Update" : "Create"}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CLabel({ l, children }: { l: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] label-track text-brand-dark/50 mb-2">{l}</label>{children}</div>;
}
