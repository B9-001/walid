"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { CartItem } from "./types";
import { supabase } from "./supabase";
import { formatNaira } from "./format";
import { fbTrack } from "./fbpixel";
import { track } from "./analytics";
import { trackCustomerEvent, clearCartSignals } from "./track";

const CART_KEY = "diamond_cart";

type AddInput = Omit<CartItem, "id" | "quantity"> & { quantity?: number };

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number; // kobo
  addItem: (item: AddInput) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  // Re-fetch every cart product and reconcile the cart against the live catalogue
  // (price, name, image, availability, stock). Mutates the cart to match reality
  // and returns a list of human-readable changes (empty = nothing changed).
  reconcile: () => Promise<string[]>;
  ready: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function sameLine(a: CartItem, b: AddInput) {
  // Bundles and the ₦500 upgrade are always their own line — never merge them
  // (two boxes may be picked differently; the upgrade must stay at ₦500). A note
  // also keeps a line separate — merging would silently hide or overwrite it.
  if (a.bundle || b.bundle || a.upgrade || b.upgrade || a.note || b.note) return false;
  return a.product_id === b.product_id;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // Load once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // Persist on change (after initial load)
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, ready]);

  // When the cart goes from having items to empty (cleared, or last item removed,
  // or cleared after a purchase), the customer no longer has an open cart — so
  // drop their "Added to cart" + "Abandoned checkout" tags. Only fires on the
  // transition to empty, never on an already-empty initial load.
  const prevCount = useRef(0);
  useEffect(() => {
    if (!ready) return;
    if (prevCount.current > 0 && items.length === 0) void clearCartSignals();
    prevCount.current = items.length;
  }, [items, ready]);

  const addItem = useCallback((input: AddInput) => {
    const qty = input.quantity || 1;
    const naira = (input.price * qty) / 100; // prices stored in kobo
    fbTrack("AddToCart", { value: naira, currency: "NGN" });
    track("add_to_cart", { label: input.name, value: Math.round(naira) });
    void trackCustomerEvent("add_to_cart", { product_id: input.product_id, product_name: input.name, value: input.price * qty });
    setItems((prev) => {
      const idx = prev.findIndex((it) => sameLine(it, input));
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + (input.quantity || 1) };
        return next;
      }
      const newItem: CartItem = {
        id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        quantity: input.quantity || 1,
        product_id: input.product_id,
        name: input.name,
        image: input.image,
        price: input.price,
        preorder_release_at: input.preorder_release_at ?? null,
        bundle: input.bundle,
        upgrade: input.upgrade,
        worth: input.worth,
        note: input.note?.trim() || undefined,
      };
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((it) => it.id !== id)
        : prev.map((it) => (it.id === id ? { ...it, quantity: qty } : it))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const reconcile = useCallback(async (): Promise<string[]> => {
    if (items.length === 0) return [];
    // Fetch every real slug we depend on: normal lines by their own id, bundle
    // lines by their component ids (the line id itself is synthetic).
    const ids = Array.from(
      new Set(
        items.flatMap((it) =>
          it.bundle ? it.bundle.components.map((c) => c.product_id) : [it.product_id]
        )
      )
    );
    const { data, error } = await supabase
      .from("diamond_products")
      .select("product_id, name, base_price, image_url, stock_level, active")
      .in("product_id", ids);
    if (error) return []; // network hiccup — don't block the customer on our error

    const byId = new Map((data || []).map((p) => [p.product_id, p]));
    const changes: string[] = [];
    const next: CartItem[] = [];

    for (const it of items) {
      // Bundle line: the fixed price never changes. Validate each picked flavour
      // is still active and in stock for the quantity picked; drop the whole box
      // if any component is gone. Refresh component thumbnails/names silently.
      if (it.bundle) {
        let broken: string | null = null;
        const components = it.bundle.components.map((c) => {
          const p = byId.get(c.product_id);
          if (!p || p.active === false) { broken ??= c.name; return c; }
          if (p.stock_level !== null && p.stock_level < c.quantity) { broken ??= p.name; return c; }
          return { ...c, name: p.name || c.name, image: p.image_url ?? c.image };
        });
        if (broken) {
          changes.push(`${it.bundle.name} was removed — ${broken} is no longer available.`);
          continue;
        }
        next.push({ ...it, bundle: { ...it.bundle, components } });
        continue;
      }

      const p = byId.get(it.product_id);

      // Removed or deactivated → drop it.
      if (!p || p.active === false) {
        changes.push(`${it.name} is no longer available and was removed from your cart.`);
        continue;
      }

      const line: CartItem = { ...it };

      // Stock — sold out removes the line, otherwise cap to what's left.
      if (p.stock_level !== null && p.stock_level < line.quantity) {
        if (p.stock_level <= 0) {
          changes.push(`${p.name} is now sold out and was removed.`);
          continue;
        }
        changes.push(`Only ${p.stock_level} of ${p.name} left — we reduced your quantity to ${p.stock_level}.`);
        line.quantity = p.stock_level;
      }

      // Upgrade line stays at its ₦500 price — never reprice it. Everything else
      // tracks the live catalogue price.
      if (!line.upgrade && typeof p.base_price === "number" && p.base_price !== line.price) {
        changes.push(`${p.name} price changed from ${formatNaira(line.price)} to ${formatNaira(p.base_price)}.`);
        line.price = p.base_price;
      }

      // Name changed → relabel (skip the upgrade's custom label).
      if (!line.upgrade && p.name && p.name !== line.name) {
        changes.push(`"${line.name}" is now called "${p.name}".`);
        line.name = p.name;
      }

      // Refresh the thumbnail silently if it moved.
      if (p.image_url !== line.image) line.image = p.image_url;

      next.push(line);
    }

    setItems(next);
    return changes;
  }, [items]);

  const count = items.reduce((n, it) => n + it.quantity, 0);
  const subtotal = items.reduce((n, it) => n + it.price * it.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, count, subtotal, addItem, removeItem, updateQty, clear, reconcile, ready }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
