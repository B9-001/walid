"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { compressImage, getPublicUrl } from "@/lib/upload";
import { formatNaira } from "@/lib/format";
import type { Product, Category } from "@/lib/types";

type FormState = {
  name: string;
  description: string;
  category: string;
  image_url: string;
  images: string[];
  base_price: number; // kobo
  stock_level: number | null; // null = unlimited
  featured: boolean;
  active: boolean;
  preorder: boolean;
  preorder_release_at: string; // datetime-local value (local time, no tz)
};

const blank = (cat: string): FormState => ({
  name: "",
  description: "",
  category: cat,
  image_url: "",
  images: [],
  base_price: 0,
  stock_level: null,
  featured: false,
  active: true,
  preorder: false,
  preorder_release_at: "",
});

// ISO <-> <input type="datetime-local"> (local time) conversions.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(blank(""));
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.from("diamond_products").select("*").order("name", { ascending: true }),
      supabase.from("diamond_categories").select("*").order("name", { ascending: true }),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (c.data) setCategories(c.data as Category[]);
    setLoading(false);
  }

  const openAdd = () => {
    setEditing(null);
    setForm(blank(categories[0]?.name || ""));
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      category: p.category,
      image_url: p.image_url || "",
      images: p.images || [],
      base_price: p.base_price,
      stock_level: p.stock_level ?? null,
      featured: p.featured,
      active: p.active,
      preorder: p.preorder ?? false,
      preorder_release_at: isoToLocalInput(p.preorder_release_at ?? null),
    });
    setOpen(true);
  };

  const uploadOne = async (file: File): Promise<string> => {
    const compressed = await compressImage(file);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${file.name
      .replace(/[^a-z0-9.]/gi, "_")
      .toLowerCase()}`;
    const { error } = await supabase.storage.from("diamond-products").upload(fileName, compressed);
    if (error) throw error;
    return getPublicUrl("diamond-products", fileName);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadOne(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onGalleryFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(uploadOne));
      setForm((f) => {
        if (!f.image_url) {
          const [first, ...rest] = urls;
          return { ...f, image_url: first, images: [...f.images, ...rest] };
        }
        return { ...f, images: [...f.images, ...urls] };
      });
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const removeImage = (i: number) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  const makeCover = (i: number) =>
    setForm((f) => {
      const url = f.images[i];
      const rest = f.images.filter((_, idx) => idx !== i);
      return { ...f, image_url: url, images: f.image_url ? [f.image_url, ...rest] : rest };
    });

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Product name is required.");
    if (!form.category) return alert("Please choose a category.");
    setSaving(true);
    try {
      const product_id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const payload = {
        product_id,
        name: form.name.trim(),
        description: form.description || null,
        category: form.category,
        image_url: form.image_url || null,
        images: form.images,
        base_price: form.base_price,
        stock_level: form.stock_level,
        featured: form.featured,
        active: form.active,
        preorder: form.preorder,
        preorder_release_at: form.preorder && form.preorder_release_at ? new Date(form.preorder_release_at).toISOString() : null,
      };
      if (editing) {
        const { error } = await supabase.from("diamond_products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("diamond_products").insert([payload]);
        if (error) throw error;
      }
      setOpen(false);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    await supabase.from("diamond_products").delete().eq("id", p.id);
    fetchAll();
  };

  const toggleActive = async (p: Product) => {
    await supabase.from("diamond_products").update({ active: !p.active }).eq("id", p.id);
    fetchAll();
  };

  const soldOut = (p: Product) => p.stock_level !== null && p.stock_level === 0;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-brand-line pb-7 mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">Products</h1>
          <p className="font-script text-2xl text-brand-primary mt-2">menu items</p>
        </div>
        <button onClick={openAdd} className="bg-brand-primary text-brand-light px-7 py-3.5 rounded-full font-sans text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all shrink-0">
          + Add Product
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="py-24 border-2 border-dashed border-brand-line rounded-2xl text-center">
          <p className="font-display text-2xl text-brand-dark/40">No products yet.</p>
          <button onClick={openAdd} className="mt-5 text-brand-primary text-xs font-bold tracking-widest uppercase border-b border-brand-primary pb-1">Add the first product</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => (
            <div key={p.id} className={`bg-brand-light border rounded-2xl overflow-hidden flex flex-col ${p.active ? "border-brand-line" : "border-red-300/40 opacity-60"}`}>
              <div className="aspect-square bg-brand-blush relative overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><span className="font-script text-3xl text-brand-primary/25">Diamond</span></div>
                )}
                <span className="absolute top-3 left-3 bg-brand-primary text-brand-light text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">{p.category}</span>
                {p.featured && <span className="absolute top-3 right-3 bg-brand-plum text-brand-light text-[8px] font-bold tracking-widest uppercase px-2 py-1 rounded-full">Featured</span>}
                {p.stock_level !== null && (
                  <span className={`absolute bottom-3 right-3 text-[8px] font-bold tracking-widest uppercase px-2 py-1 rounded-full ${soldOut(p) ? "bg-red-500 text-white" : "bg-brand-light/90 text-brand-dark"}`}>
                    {soldOut(p) ? "Sold out" : `Stock: ${p.stock_level}`}
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-display text-lg text-brand-dark leading-tight">{p.name}</h3>
                <span className="font-sans text-sm font-semibold text-brand-primary">{formatNaira(p.base_price)}</span>
                <div className="flex gap-2 mt-auto pt-2">
                  <button onClick={() => openEdit(p)} className="flex-1 py-2 border border-brand-line rounded-full text-[9px] font-bold tracking-widest uppercase text-brand-dark hover:bg-brand-dark hover:text-brand-light transition-colors">Edit</button>
                  <button onClick={() => toggleActive(p)} className="flex-1 py-2 border border-brand-line rounded-full text-[9px] font-bold tracking-widest uppercase text-brand-dark/60 hover:bg-brand-plum hover:text-brand-light transition-colors">{p.active ? "Hide" : "Show"}</button>
                  <button onClick={() => handleDelete(p)} className="px-3 py-2 border border-red-200 rounded-full text-red-400 hover:bg-red-500 hover:text-white transition-colors" aria-label="delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-0 md:p-8 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="relative w-full max-w-2xl bg-brand-cream md:rounded-3xl my-0 md:my-8 max-h-screen md:max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-brand-cream z-10 px-6 md:px-8 py-5 flex justify-between items-center border-b border-brand-line">
                <h3 className="font-display text-2xl md:text-3xl text-brand-dark">{editing ? "Edit Product" : "Add Product"}</h3>
                <button onClick={() => setOpen(false)} className="text-brand-dark/40 hover:text-brand-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                {/* Images + core fields */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label>Cover image</Label>
                    <div onClick={() => fileRef.current?.click()} className="aspect-square bg-brand-light border-2 border-dashed border-brand-line hover:border-brand-primary/50 rounded-2xl cursor-pointer flex items-center justify-center overflow-hidden group">
                      {form.image_url ? (
                        <div className="relative w-full h-full">
                          <img src={form.image_url} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-brand-light/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span className="text-brand-dark text-[10px] font-bold tracking-widest uppercase">Change</span></div>
                        </div>
                      ) : (
                        <span className="text-brand-grey text-[10px] uppercase font-bold tracking-widest text-center px-4">{uploading ? "Uploading…" : "Click to upload image"}</span>
                      )}
                    </div>
                    <input type="file" ref={fileRef} onChange={onFile} accept="image/*" className="hidden" />

                    <div className="flex items-center justify-between mt-4 mb-2">
                      <Label>More images <span className="normal-case opacity-60">(optional)</span></Label>
                      <button onClick={() => galleryRef.current?.click()} className="text-brand-primary text-[10px] font-bold tracking-widest uppercase">{uploading ? "Uploading…" : "+ Add"}</button>
                    </div>
                    <input type="file" ref={galleryRef} onChange={onGalleryFiles} accept="image/*" multiple className="hidden" />
                    {form.images.length === 0 ? (
                      <p className="text-brand-grey text-[11px]">No extra images yet.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {form.images.map((url, i) => (
                          <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-brand-light border border-brand-line group">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-brand-dark/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                              <button onClick={() => makeCover(i)} className="text-brand-light text-[8px] font-bold tracking-widest uppercase hover:text-brand-primary">Make cover</button>
                              <button onClick={() => removeImage(i)} className="text-brand-light text-[8px] font-bold tracking-widest uppercase hover:text-red-300">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <FieldText label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Lotus Milkcake" />
                    <div>
                      <Label>Category</Label>
                      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary">
                        {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <FieldNaira label="Price" valueKobo={form.base_price} onChangeKobo={(k) => setForm({ ...form, base_price: k })} />
                    <div>
                      <Label>Stock level <span className="normal-case opacity-60">(leave blank for unlimited)</span></Label>
                      <input
                        type="number"
                        min="0"
                        value={form.stock_level ?? ""}
                        onChange={(e) => setForm({ ...form, stock_level: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value)) })}
                        placeholder="Unlimited"
                        className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums"
                      />
                      {form.stock_level === 0 && (
                        <p className="mt-1.5 text-[11px] text-brand-primary font-medium">Stock is 0 — product will show as sold out.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary resize-none" />
                </div>

                <div className="border-t border-brand-line pt-5 grid grid-cols-2 gap-3">
                  <Toggle label="Featured on home" checked={form.featured} onChange={(v) => setForm({ ...form, featured: v })} />
                  <Toggle label="Visible on site" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
                </div>

                <div className="border-t border-brand-line pt-5">
                  <Toggle label="Available for pre-order" checked={form.preorder} onChange={(v) => setForm({ ...form, preorder: v })} />
                  {form.preorder && (
                    <div className="mt-3">
                      <Label>Available from <span className="normal-case opacity-60">(date &amp; time it releases)</span></Label>
                      <input
                        type="datetime-local"
                        value={form.preorder_release_at}
                        onChange={(e) => setForm({ ...form, preorder_release_at: e.target.value })}
                        className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
                      />
                      <p className="mt-1.5 text-[11px] text-brand-grey">Customers can order now; it shows a “Pre-order” badge until this time, then becomes a normal product.</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setOpen(false)} className="flex-1 py-3.5 border border-brand-line rounded-full text-[10px] font-bold tracking-widest uppercase text-brand-dark">Cancel</button>
                  <button onClick={handleSave} disabled={saving || uploading} className="flex-1 py-3.5 bg-brand-primary text-brand-light rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-50">
                    {saving ? "Saving…" : editing ? "Update" : "Save Product"}
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

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">{children}</label>;
}

function FieldText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary" />
    </div>
  );
}

function FieldNaira({ label, valueKobo, onChangeKobo }: { label: string; valueKobo: number; onChangeKobo: (kobo: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-grey text-sm">₦</span>
        <input type="number" min="0" value={valueKobo ? valueKobo / 100 : ""} onChange={(e) => onChangeKobo(Math.round(Number(e.target.value) * 100))} className="w-full bg-brand-light border border-brand-line rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-brand-primary tabular-nums" />
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer bg-brand-light border border-brand-line rounded-xl px-4 py-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-brand-primary" />
      <span className="font-sans text-[11px] font-medium text-brand-dark">{label}</span>
    </label>
  );
}
