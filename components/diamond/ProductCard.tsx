"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Product } from "@/lib/types";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { isQuickAdd, isPreorder, formatPreorderDate } from "@/lib/product";
import { checkOne } from "@/lib/stock";

// Lowest price across size tiers, falling back to base_price.
function fromPrice(p: Product): number {
  if (p.sizes && p.sizes.length > 0) {
    return Math.min(...p.sizes.map((s) => s.price));
  }
  return p.base_price;
}

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const price = fromPrice(product);
  const onSale = product.old_price && product.old_price > price;
  const soldOut = product.stock_level !== null && product.stock_level === 0;
  const quickAdd = isQuickAdd(product);
  const preorder = isPreorder(product);

  const { items, addItem, updateQty } = useCart();
  const line = items.find((it) => it.product_id === product.product_id);

  const [stockMsg, setStockMsg] = useState("");
  const flash = (available: number | null) => {
    setStockMsg(available === 0 ? "Sold out" : `Only ${available} left`);
    setTimeout(() => setStockMsg(""), 2500);
  };

  // Confirm live stock before adding/incrementing so the cart can't exceed stock.
  const add = async () => {
    const { ok, available } = await checkOne(product.product_id, (line?.quantity || 0) + 1);
    if (!ok) return flash(available);
    addItem({ product_id: product.product_id, name: product.name, image: product.image_url, price: product.base_price, preorder_release_at: preorder ? product.preorder_release_at : null });
  };
  const inc = async () => {
    if (!line) return;
    const { ok, available } = await checkOne(product.product_id, line.quantity + 1);
    if (!ok) return flash(available);
    updateQty(line.id, line.quantity + 1);
  };

  const detailHref = `/product?id=${product.id}`;

  // Gallery: primary image + any extra images, so cards can be flicked through.
  const gallery = [product.image_url, ...(product.images || [])].filter(Boolean) as string[];
  const [img, setImg] = useState(0);
  const step = (e: React.MouseEvent, dir: number) => {
    e.preventDefault();
    e.stopPropagation();
    setImg((i) => (i + dir + gallery.length) % gallery.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ 
        duration: 0.7, 
        delay: (index % 4) * 0.1,
        ease: "easeOut"
      }}
      className="h-full"
    >
      <div className="card-soft h-full flex flex-col">
        <Link href={detailHref} className="group block relative aspect-square overflow-hidden">
          {gallery.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="w-full h-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img
                key={img}
                src={gallery[img]}
                alt={product.name}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className={`w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110 ${soldOut ? "grayscale-[0.4]" : ""}`}
              />
            </motion.div>
          ) : (
            <div className="placeholder-sweet w-full h-full flex flex-col items-center justify-center">
              <span className="relative z-10 font-script text-4xl text-brand-primary/45 leading-none">thepufflette</span>
              <span className="relative z-10 font-sans text-[9px] tracking-[0.32em] uppercase text-brand-primary/40 mt-1">.co</span>
            </div>
          )}

          {/* Image carousel — arrows + dots, only when there's more than one photo */}
          {gallery.length > 1 && (
            <>
              <motion.button
                type="button"
                onClick={(e) => step(e, -1)}
                aria-label="Previous image"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-brand-light/80 backdrop-blur text-brand-dark flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-brand-light"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" /></svg>
              </motion.button>
              <motion.button
                type="button"
                onClick={(e) => step(e, 1)}
                aria-label="Next image"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-brand-light/80 backdrop-blur text-brand-dark flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-brand-light"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" /></svg>
              </motion.button>
              <motion.div 
                className="absolute bottom-2.5 left-0 right-0 z-10 flex justify-center gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              >
                {gallery.map((_, i) => (
                  <motion.span 
                    key={i} 
                    initial={false}
                    animate={{
                      width: i === img ? 16 : 6,
                      backgroundColor: i === img ? "rgb(var(--color-brand-light))" : "rgba(255,255,255,0.6)"
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="h-1.5 rounded-full"
                  />
                ))}
              </motion.div>
            </>
          )}

          {/* Status badges with smooth animations */}
          {preorder && !soldOut && (
            <motion.span 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute top-3 left-3 bg-brand-plum text-brand-light text-[10px] tracking-[0.18em] uppercase font-semibold px-3 py-1 rounded-full shadow-sm"
            >
              Pre-order
            </motion.span>
          )}
          {product.featured && !soldOut && !preorder && (
            <motion.span 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
              className="absolute top-3 left-3 bg-brand-light/90 backdrop-blur text-brand-plum text-[10px] tracking-[0.18em] uppercase font-semibold px-3 py-1 rounded-full shadow-sm"
            >
              Bestseller
            </motion.span>
          )}
          {soldOut && (
            <motion.span 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute top-3 left-3 bg-brand-dark/85 text-brand-light text-[10px] tracking-[0.18em] uppercase font-semibold px-3 py-1 rounded-full"
            >
              Sold Out
            </motion.span>
          )}
          {onSale && !soldOut && (
            <motion.span 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
              className="absolute top-3 right-3 bg-brand-primary text-brand-light text-[10px] tracking-[0.18em] uppercase font-semibold px-3 py-1 rounded-full shadow-sm"
            >
              Sale
            </motion.span>
          )}
        </Link>

        <div className="p-5 flex flex-col flex-1">
          <span className="text-[10px] tracking-[0.28em] uppercase text-brand-primary/70 font-semibold">{product.category}</span>
          <Link href={detailHref}>
            <h3 className="font-display text-xl text-brand-dark leading-snug mt-1.5 hover:text-brand-primary transition-colors">{product.name}</h3>
          </Link>
          {preorder && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="mt-1.5 text-[11px] font-medium text-brand-plum"
            >
              Available {formatPreorderDate(product.preorder_release_at)}
            </motion.p>
          )}

          <div className="mt-auto pt-4 flex items-end justify-between gap-2 border-t border-brand-line/60 mt-3">
            <motion.div 
              className="pt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeInOut", delay: 0.1 }}
            >
              <span className="font-display text-xl text-brand-dark">{formatNaira(price)}</span>
              {onSale && <span className="ml-2 text-sm text-brand-grey line-through font-sans">{formatNaira(product.old_price!)}</span>}
            </motion.div>

            <motion.div 
              className="pt-3 shrink-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeInOut", delay: 0.15 }}
            >
              {quickAdd ? (
                line ? (
                  <div className="inline-flex flex-col items-end gap-1">
                    <motion.div 
                      className="inline-flex items-center border border-brand-line rounded-full overflow-hidden"
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <button onClick={() => updateQty(line.id, line.quantity - 1)} className="w-8 h-8 text-brand-primary hover:bg-brand-blush transition-colors text-lg leading-none">−</button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                      <button onClick={inc} className="w-8 h-8 text-brand-primary hover:bg-brand-blush transition-colors text-lg leading-none">+</button>
                    </motion.div>
                    {stockMsg && (
                      <motion.span 
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="text-[10px] font-semibold text-brand-primary whitespace-nowrap"
                      >
                        {stockMsg}
                      </motion.span>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex flex-col items-end gap-1">
                    <motion.button 
                      onClick={add} 
                      aria-label={`Add ${product.name}`} 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-9 h-9 rounded-full bg-brand-primary text-brand-light flex items-center justify-center hover:bg-brand-primary-dark transition-colors text-xl leading-none shadow-sm"
                    >
                      +
                    </motion.button>
                    {stockMsg && (
                      <motion.span 
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="text-[10px] font-semibold text-brand-primary whitespace-nowrap"
                      >
                        {stockMsg}
                      </motion.span>
                    )}
                  </div>
                )
              ) : (
                <Link href={detailHref} className="text-[11px] tracking-[0.18em] uppercase font-semibold text-brand-primary hover:translate-x-1 transition-transform inline-block">View</Link>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
