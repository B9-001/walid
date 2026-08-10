"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type Slide = { id: string; image_url: string; heading: string | null; subheading: string | null };

// Text-first hero, stacked vertically: HEADLINE, then SUBHEADING, then the IMAGE, then the CTA.
// The headline and subheading render instantly as real text (editable per slide in admin), so the
// visitor reads the message before any image loads. Sensible defaults show even before data arrives.
const DEFAULT_HEADING = "Freshly baked, delivered across Abuja";
const DEFAULT_SUB = "Soft milkcakes, creamy cake tubs and rich cheesecakes, made fresh to order and brought straight to your door.";

// Default slides with local images
const DEFAULT_SLIDES: Slide[] = [
  {
    id: "hero-1",
    image_url: "/heroes/hero-1.jpg",
    heading: "Freshly Baked Daily",
    subheading: "Premium cakes made with love and the finest ingredients"
  },
  {
    id: "hero-2",
    image_url: "/heroes/hero-2.jpg",
    heading: "Delivered Fresh",
    subheading: "Order today, receive tomorrow. Fresh from our kitchen to your door"
  },
  {
    id: "hero-3",
    image_url: "/heroes/hero-3.jpg",
    heading: "Custom Orders Welcome",
    subheading: "Celebrate your special moments with our custom cake designs"
  },
  {
    id: "hero-4",
    image_url: "/heroes/hero-4.jpg",
    heading: "Taste the Difference",
    subheading: "Experience the finest quality cakes in Abuja"
  }
];

export default function Hero() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [current, setCurrent] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Try to fetch from Supabase, but fall back to defaults if empty
    const fetchSlides = async () => {
      try {
        const { data, error } = await supabase
          .from("diamond_hero_images")
          .select("id, image_url, heading, subheading")
          .order("order_index", { ascending: true });
        
        if (error || !data || data.length === 0) {
          // Keep default slides
          setSlides(DEFAULT_SLIDES);
        } else {
          setSlides(data as Slide[]);
        }
      } catch (err) {
        // Keep default slides on error
        setSlides(DEFAULT_SLIDES);
      }
    };

    fetchSlides();
  }, []);

  useEffect(() => {
    if (slides.length < 2 || !isAutoPlay) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides, isAutoPlay]);

  const slide = slides[current];
  const heading = slide?.heading?.trim() || DEFAULT_HEADING;
  const sub = slide?.subheading?.trim() || DEFAULT_SUB;

  const handlePrev = () => {
    setIsAutoPlay(false);
    setCurrent((c) => (c - 1 + slides.length) % slides.length);
    setTimeout(() => setIsAutoPlay(true), 8000);
  };

  const handleNext = () => {
    setIsAutoPlay(false);
    setCurrent((c) => (c + 1) % slides.length);
    setTimeout(() => setIsAutoPlay(true), 8000);
  };

  return (
    <section className="bg-brand-paper">
      <div className="container py-12 md:py-16 text-center">
        <div className="max-w-2xl mx-auto">
          {/* 1. Headline (bold), the very first thing the visitor sees */}
          <span className="eyebrow">Freshly baked in Abuja</span>
          <AnimatePresence mode="wait">
            <motion.h1
              key={heading}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="font-display font-bold text-4xl sm:text-5xl md:text-6xl leading-[1.05] text-brand-dark mt-4"
            >
              {heading}
            </motion.h1>
          </AnimatePresence>

          {/* 2. Subheading with smooth transition */}
          <AnimatePresence mode="wait">
            <motion.p
              key={sub}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: "easeInOut", delay: 0.1 }}
              className="mt-5 text-brand-dark/70 text-base md:text-lg max-w-xl mx-auto leading-relaxed"
            >
              {sub}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* 3. Image carousel with enhanced animations */}
        <div className="mx-auto w-full max-w-[420px] mt-9">
          <div className="relative aspect-[4/5] rounded-[1.75rem] overflow-hidden ring-1 ring-brand-line shadow-[0_30px_70px_-25px_rgba(43,23,34,0.3)] bg-brand-blush group">
            <span className="absolute inset-0 flex items-center justify-center font-script text-5xl text-brand-primary/20 select-none z-0">Diamond Taste</span>
            
            <AnimatePresence mode="wait">
              {slide?.image_url && (
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, scale: 1.08 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full"
                  onAnimationComplete={() => setImageLoaded(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.image_url}
                    alt={heading}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails to load
                      console.error("Image failed to load:", slide.image_url);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation arrows */}
            {slides.length > 1 && (
              <>
                <motion.button
                  onClick={handlePrev}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-brand-light/80 backdrop-blur text-brand-dark flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-light"
                  aria-label="Previous slide"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                  </svg>
                </motion.button>
                <motion.button
                  onClick={handleNext}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-brand-light/80 backdrop-blur text-brand-dark flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-light"
                  aria-label="Next slide"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </>
            )}

            {/* Slide indicators with smooth animation */}
            {slides.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2">
                {slides.map((s, i) => (
                  <motion.button
                    key={s.id}
                    onClick={() => {
                      setIsAutoPlay(false);
                      setCurrent(i);
                      setTimeout(() => setIsAutoPlay(true), 8000);
                    }}
                    initial={false}
                    animate={{
                      width: i === current ? 24 : 6,
                      backgroundColor: i === current ? "rgb(var(--color-brand-primary))" : "rgba(255,255,255,0.4)"
                    }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="h-1.5 rounded-full cursor-pointer"
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Call to action (below the image) with staggered animation */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut", delay: 0.2 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/shop" className="btn-brand">Order Now</Link>
          <Link href="/shop?category=milkcakes" className="btn-ghost">Our Milkcakes</Link>
        </motion.div>
      </div>
    </section>
  );
}
