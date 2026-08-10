"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/format";

export default function AdminSettings() {
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    delivery_fee: 0, // kobo
    free_delivery_threshold: 0, // kobo
    contact_phone: "",
    contact_email: "",
    whatsapp_number: "",
    instagram_handle: "",
    pickup_address: "",
    announcement: "",
  });

  useEffect(() => {
    supabase.from("diamond_site_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setId(data.id);
        setForm({
          delivery_fee: data.delivery_fee || 0,
          free_delivery_threshold: data.free_delivery_threshold || 0,
          contact_phone: data.contact_phone || "",
          contact_email: data.contact_email || "",
          whatsapp_number: data.whatsapp_number || "",
          instagram_handle: data.instagram_handle || "",
          pickup_address: data.pickup_address || "",
          announcement: data.announcement || "",
        });
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        ...form,
        free_delivery_threshold: form.free_delivery_threshold || null,
      };
      if (id) {
        const { error } = await supabase.from("diamond_site_settings").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("diamond_site_settings").insert([payload]).select().single();
        if (error) throw error;
        setId(data.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="border-b border-brand-line pb-7 mb-8">
        <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">Settings</h1>
        <p className="font-script text-2xl text-brand-primary mt-2">your shop details</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Section title="Delivery">
          <div className="grid sm:grid-cols-2 gap-4">
            <Naira label="Default delivery fee" valueKobo={form.delivery_fee} onChange={(k) => setForm({ ...form, delivery_fee: k })} />
            <Naira label="Free delivery over (0 = never)" valueKobo={form.free_delivery_threshold} onChange={(k) => setForm({ ...form, free_delivery_threshold: k })} />
          </div>
          <Text label="Pickup address" value={form.pickup_address} onChange={(v) => setForm({ ...form, pickup_address: v })} />
        </Section>

        <Section title="Contact">
          <div className="grid sm:grid-cols-2 gap-4">
            <Text label="Phone" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
            <Text label="Email" value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} />
            <Text label="WhatsApp number" value={form.whatsapp_number} onChange={(v) => setForm({ ...form, whatsapp_number: v })} />
            <Text label="Instagram handle" value={form.instagram_handle} onChange={(v) => setForm({ ...form, instagram_handle: v })} />
          </div>
        </Section>

        <Section title="Announcement bar">
          <Text label="Top bar message (leave empty to hide)" value={form.announcement} onChange={(v) => setForm({ ...form, announcement: v })} />
        </Section>

        <div className="flex items-center gap-4">
          <button onClick={save} disabled={saving} className="bg-brand-primary text-brand-light px-9 py-3.5 rounded-full font-sans text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-50">{saving ? "Saving…" : "Save Settings"}</button>
          {saved && <span className="text-brand-plum text-sm font-medium">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-light border border-brand-line rounded-2xl p-6 space-y-4">
      <h2 className="font-display text-xl text-brand-dark">{title}</h2>
      {children}
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] label-track text-brand-dark/50 mb-2">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary" />
    </div>
  );
}

function Naira({ label, valueKobo, onChange }: { label: string; valueKobo: number; onChange: (kobo: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] label-track text-brand-dark/50 mb-2">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-grey text-sm">₦</span>
        <input type="number" min="0" value={valueKobo ? valueKobo / 100 : ""} onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))} className="w-full bg-brand-paper border border-brand-line rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums" />
      </div>
    </div>
  );
}
