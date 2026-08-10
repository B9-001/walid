"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira, errorMessage } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import type { DeliveryFee } from "@/lib/types";

const blank = () => ({ location: "", fee: 0, is_active: true });

export default function AdminDelivery() {
  const [fees, setFees] = useState<DeliveryFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryFee | null>(null);
  const [form, setForm] = useState(blank());

  useEffect(() => { fetchFees(); }, []);

  async function fetchFees() {
    setLoading(true);
    const { data } = await supabase
      .from("diamond_delivery_fees")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setFees(data);
    setLoading(false);
  }

  const openAdd = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (f: DeliveryFee) => {
    setEditing(f);
    setForm({ location: f.location, fee: f.fee, is_active: f.is_active });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.location.trim()) return alert("Location name is required.");
    if (form.fee <= 0) return alert("Fee must be greater than 0.");
    setSaving(true);
    try {
      const payload = {
        location: form.location.trim(),
        fee: form.fee,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("diamond_delivery_fees").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const maxOrder = fees.length > 0 ? Math.max(...fees.map((f) => f.sort_order)) : 0;
        const { error } = await supabase.from("diamond_delivery_fees").insert([{ ...payload, sort_order: maxOrder + 1 }]);
        if (error) throw error;
      }
      setOpen(false);
      fetchFees();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: DeliveryFee) => {
    if (!window.confirm(`Remove delivery area "${f.location}"?`)) return;
    await supabase.from("diamond_delivery_fees").delete().eq("id", f.id);
    fetchFees();
  };

  const toggleActive = async (f: DeliveryFee) => {
    await supabase.from("diamond_delivery_fees").update({ is_active: !f.is_active }).eq("id", f.id);
    fetchFees();
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-brand-line pb-7 mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">Delivery Fees</h1>
          <p className="font-script text-2xl text-brand-primary mt-2">areas &amp; rates</p>
        </div>
        <button onClick={openAdd} className="bg-brand-primary text-brand-light px-7 py-3.5 rounded-full font-sans text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all shrink-0">
          + New Area
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : fees.length === 0 ? (
        <div className="py-24 border-2 border-dashed border-brand-line rounded-2xl text-center">
          <p className="font-display text-2xl text-brand-dark/40">No delivery areas yet.</p>
        </div>
      ) : (
        <div className="border border-brand-line rounded-2xl overflow-hidden bg-brand-light">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 bg-brand-paper border-b border-brand-line">
            <span className="font-sans text-[10px] tracking-widest uppercase text-brand-dark/40">Area</span>
            <span className="font-sans text-[10px] tracking-widest uppercase text-brand-dark/40 text-right w-20">Fee</span>
            <span className="font-sans text-[10px] tracking-widest uppercase text-brand-dark/40 text-center w-12">Status</span>
            <span className="w-16" />
          </div>

          {fees.map((f, i) => (
            <div
              key={f.id}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 ${i !== fees.length - 1 ? "border-b border-brand-line" : ""} ${!f.is_active ? "opacity-40" : ""}`}
            >
              <span className="font-sans text-sm text-brand-dark">{f.location}</span>
              <span className="font-sans text-sm font-semibold text-brand-plum tabular-nums text-right w-20">{formatNaira(f.fee)}</span>
              <div className="flex justify-center w-12">
                <button
                  onClick={() => toggleActive(f)}
                  title={f.is_active ? "Active — click to disable" : "Inactive — click to enable"}
                  className={`w-2 h-2 rounded-full transition-colors ${f.is_active ? "bg-green-400" : "bg-brand-line"}`}
                />
              </div>
              <div className="flex items-center gap-1 w-16 justify-end">
                <button
                  onClick={() => openEdit(f)}
                  className="p-1.5 rounded-lg text-brand-dark/30 hover:text-brand-primary hover:bg-brand-blush/40 transition-colors"
                  title="Edit"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(f)}
                  className="p-1.5 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="relative w-full max-w-md bg-brand-cream rounded-3xl">
              <div className="px-7 py-5 flex justify-between items-center border-b border-brand-line">
                <h3 className="font-display text-2xl text-brand-dark">{editing ? "Edit Area" : "New Delivery Area"}</h3>
                <button onClick={() => setOpen(false)} className="text-brand-dark/40 hover:text-brand-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-7 space-y-4">
                <FLabel l="Location name">
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Maitama"
                    className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </FLabel>
                <FLabel l="Delivery fee (₦)">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={form.fee ? form.fee / 100 : ""}
                    onChange={(e) => setForm({ ...form, fee: Math.round(Number(e.target.value) * 100) })}
                    placeholder="e.g. 3500"
                    className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums"
                  />
                </FLabel>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-brand-primary" />
                  <span className="text-[11px] font-medium text-brand-dark">Active (visible at checkout)</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setOpen(false)} className="flex-1 py-3.5 border border-brand-line rounded-full text-[10px] font-bold tracking-widest uppercase text-brand-dark">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-3.5 bg-brand-primary text-brand-light rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-50">
                    {saving ? "Saving…" : editing ? "Update" : "Add Area"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FLabel({ l, children }: { l: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] label-track text-brand-dark/50 mb-2">{l}</label>{children}</div>;
}
