"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { compressImage, getPublicUrl } from "@/lib/upload";
import { errorMessage } from "@/lib/format";
import type { Category } from "@/lib/types";

const blank = () => ({ name: "", slug: "", description: "", image_url: null as string | null, sort_order: 0 });

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(blank());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchCategories(); }, []);

  async function fetchCategories() {
    setLoading(true);
    const { data } = await supabase.from("diamond_categories").select("*").order("sort_order", { ascending: true });
    if (data) setCategories(data as Category[]);
    setLoading(false);
  }

  const openAdd = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, description: c.description || "", image_url: c.image_url, sort_order: c.sort_order });
    setOpen(true);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const fileName = `category-${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()}`;
      const { error } = await supabase.storage.from("diamond-products").upload(fileName, compressed);
      if (error) throw error;
      setForm((f) => ({ ...f, image_url: getPublicUrl("diamond-products", fileName) }));
    } catch (err) {
      alert(errorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Name is required.");
    setSaving(true);
    try {
      const slug = (form.slug.trim() || form.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const payload = { name: form.name.trim(), slug, description: form.description || null, image_url: form.image_url, sort_order: form.sort_order };
      if (editing) {
        const { error } = await supabase.from("diamond_categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("diamond_categories").insert([payload]);
        if (error) throw error;
      }
      setOpen(false);
      fetchCategories();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Category) => {
    if (!window.confirm(`Delete "${c.name}"? Products keep their category name but the tile disappears.`)) return;
    await supabase.from("diamond_categories").delete().eq("id", c.id);
    fetchCategories();
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-brand-line pb-7 mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">Categories</h1>
          <p className="font-script text-2xl text-brand-primary mt-2">shop sections</p>
          <p className="font-sans text-xs text-brand-dark/40 mt-3 max-w-md">The tiles customers tap to browse — e.g. Gourmet Puff Puff, Gourmet Pancakes. Products are assigned to a category by name.</p>
        </div>
        <button onClick={openAdd} className="bg-brand-primary text-brand-light px-7 py-3.5 rounded-full font-sans text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all shrink-0">+ New Category</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <div key={c.id} className="bg-brand-light border border-brand-line rounded-2xl overflow-hidden flex flex-col">
              <div className="relative aspect-[4/3] bg-brand-blush overflow-hidden">
                {c.image_url ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="font-script text-2xl text-brand-primary/25 text-center px-2">{c.name}</span></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/50 to-transparent" />
                <h3 className="absolute bottom-0 left-0 right-0 p-3 font-display text-base text-brand-light leading-tight">{c.name}</h3>
              </div>
              <div className="flex border-t border-brand-line">
                <button onClick={() => openEdit(c)} className="flex-1 py-2.5 text-[9px] font-bold tracking-widest uppercase text-brand-dark/50 hover:bg-brand-blush border-r border-brand-line transition-colors">Edit</button>
                <button onClick={() => handleDelete(c)} className="flex-1 py-2.5 text-[9px] font-bold tracking-widest uppercase text-red-400/70 hover:bg-red-50 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="relative w-full max-w-lg bg-brand-cream rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="px-7 py-5 flex justify-between items-center border-b border-brand-line">
                <h3 className="font-display text-2xl text-brand-dark">{editing ? "Edit Category" : "New Category"}</h3>
                <button onClick={() => setOpen(false)} className="text-brand-dark/40 hover:text-brand-primary"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-7 space-y-4">
                <div onClick={() => fileRef.current?.click()} className="aspect-video bg-brand-light border-2 border-dashed border-brand-line hover:border-brand-primary/50 rounded-2xl cursor-pointer flex items-center justify-center overflow-hidden group">
                  {form.image_url ? (
                    <div className="relative w-full h-full"><img src={form.image_url} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-brand-light/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span className="text-brand-dark text-[10px] font-bold tracking-widest uppercase">Change</span></div></div>
                  ) : <span className="text-brand-grey text-[10px] uppercase font-bold tracking-widest">{uploading ? "Uploading…" : "Click to upload image"}</span>}
                </div>
                <input type="file" ref={fileRef} onChange={onFile} accept="image/*" className="hidden" />
                <div><label className="block text-[10px] label-track text-brand-dark/50 mb-2">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Birthday Cakes" className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary" /></div>
                <div><label className="block text-[10px] label-track text-brand-dark/50 mb-2">Description</label><input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary" /></div>
                <div><label className="block text-[10px] label-track text-brand-dark/50 mb-2">Sort order</label><input type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums" /></div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setOpen(false)} className="flex-1 py-3.5 border border-brand-line rounded-full text-[10px] font-bold tracking-widest uppercase text-brand-dark">Cancel</button>
                  <button onClick={handleSave} disabled={saving || uploading} className="flex-1 py-3.5 bg-brand-primary text-brand-light rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-50">{saving ? "Saving…" : editing ? "Update" : "Create"}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
