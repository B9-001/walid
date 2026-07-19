"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { compressImage, getPublicUrl } from "@/lib/upload";
import { errorMessage } from "@/lib/format";
import type { HeroImage } from "@/lib/types";

export default function AdminHero() {
  const [slides, setSlides] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSlides(); }, []);

  async function fetchSlides() {
    setLoading(true);
    const { data } = await supabase.from("diamond_hero_images").select("*").order("order_index", { ascending: true });
    if (data) setSlides(data);
    setLoading(false);
  }

  const upload = async (file: File): Promise<string> => {
    const compressed = await compressImage(file);
    const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()}`;
    const { error } = await supabase.storage.from("diamond-hero").upload(fileName, compressed);
    if (error) throw error;
    return getPublicUrl("diamond-hero", fileName);
  };

  const onAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const image_url = await upload(file);
      const { error } = await supabase.from("diamond_hero_images").insert([{ image_url, order_index: slides.length }]);
      if (error) throw error;
      fetchSlides();
    } catch (err) { alert(errorMessage(err, "Upload failed")); }
    finally { setUploading(false); if (addRef.current) addRef.current.value = ""; }
  };

  const onReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingId) return;
    setUploading(true);
    try {
      const image_url = await upload(file);
      const { error } = await supabase.from("diamond_hero_images").update({ image_url }).eq("id", replacingId);
      if (error) throw error;
      fetchSlides();
    } catch (err) { alert(errorMessage(err, "Replace failed")); }
    finally { setUploading(false); setReplacingId(null); if (replaceRef.current) replaceRef.current.value = ""; }
  };

  const startReplace = (id: string) => { setReplacingId(id); replaceRef.current?.click(); };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this slide?")) return;
    await supabase.from("diamond_hero_images").delete().eq("id", id);
    fetchSlides();
  };

  const move = async (index: number, dir: "up" | "down") => {
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= slides.length) return;
    const a = slides[index], b = slides[swap];
    await Promise.all([
      supabase.from("diamond_hero_images").update({ order_index: b.order_index }).eq("id", a.id),
      supabase.from("diamond_hero_images").update({ order_index: a.order_index }).eq("id", b.id),
    ]);
    fetchSlides();
  };

  const saveText = async (id: string, patch: { heading?: string; subheading?: string }) => {
    await supabase.from("diamond_hero_images").update(patch).eq("id", id);
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-brand-line pb-7 mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">Hero Slides</h1>
          <p className="font-script text-2xl text-brand-primary mt-2">homepage banner</p>
          <p className="font-sans text-xs text-brand-dark/40 mt-3 max-w-md">Images cycle on the homepage. Add a heading/subheading to overlay text, reorder with the arrows, or replace an image in place.</p>
        </div>
        <button onClick={() => addRef.current?.click()} disabled={uploading} className="bg-brand-primary text-brand-light px-7 py-3.5 rounded-full font-sans text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all shrink-0 disabled:opacity-50">{uploading ? "Uploading…" : "+ Add Slide"}</button>
        <input type="file" ref={addRef} onChange={onAdd} accept="image/*" className="hidden" />
        <input type="file" ref={replaceRef} onChange={onReplace} accept="image/*" className="hidden" />
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : slides.length === 0 ? (
        <div className="py-24 border-2 border-dashed border-brand-line rounded-2xl text-center">
          <p className="font-display text-2xl text-brand-dark/40 mb-5">No slides yet.</p>
          <button onClick={() => addRef.current?.click()} className="text-brand-primary text-xs font-bold tracking-widest uppercase border-b border-brand-primary pb-1">Upload the first slide</button>
        </div>
      ) : (
        <div className="space-y-5">
          {slides.map((s, i) => (
            <motion.div key={s.id} layout className="bg-brand-light border border-brand-line rounded-2xl overflow-hidden flex flex-col sm:flex-row">
              <div className="relative sm:w-72 aspect-video shrink-0 bg-brand-blush">
                <img src={s.image_url} className="w-full h-full object-cover" alt="" />
                <span className="absolute top-3 left-3 bg-brand-primary text-brand-light text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">Slide {String(i + 1).padStart(2, "0")}</span>
                <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                  <button onClick={() => move(i, "up")} disabled={i === 0} className="w-7 h-7 bg-brand-light/90 rounded-full flex items-center justify-center text-brand-dark hover:bg-brand-primary hover:text-brand-light transition-all disabled:opacity-20"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg></button>
                  <button onClick={() => move(i, "down")} disabled={i === slides.length - 1} className="w-7 h-7 bg-brand-light/90 rounded-full flex items-center justify-center text-brand-dark hover:bg-brand-primary hover:text-brand-light transition-all disabled:opacity-20"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg></button>
                </div>
              </div>
              <div className="flex-1 p-5 space-y-3">
                <div><label className="block text-[10px] label-track text-brand-dark/50 mb-1.5">Heading</label><input defaultValue={s.heading || ""} onBlur={(e) => saveText(s.id, { heading: e.target.value })} placeholder="Cakes worth…" className="w-full bg-brand-cream border border-brand-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary" /></div>
                <div><label className="block text-[10px] label-track text-brand-dark/50 mb-1.5">Subheading</label><input defaultValue={s.subheading || ""} onBlur={(e) => saveText(s.id, { subheading: e.target.value })} placeholder="Short tagline…" className="w-full bg-brand-cream border border-brand-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary" /></div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => startReplace(s.id)} disabled={uploading} className="flex-1 py-2.5 border border-brand-line rounded-full text-[9px] font-bold tracking-widest uppercase text-brand-dark hover:bg-brand-dark hover:text-brand-light transition-colors">Replace Image</button>
                  <button onClick={() => handleDelete(s.id)} className="px-4 py-2.5 border border-red-200 rounded-full text-red-400 hover:bg-red-500 hover:text-white transition-colors text-[9px] font-bold tracking-widest uppercase">Remove</button>
                </div>
                <p className="text-[10px] text-brand-grey">Text changes save when you click away.</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
