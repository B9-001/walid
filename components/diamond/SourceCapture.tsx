"use client";

import { useEffect } from "react";
import { captureSource } from "@/lib/source";

// Captures the link source (?source=ads, ?source=bio, ?ref=…, ?utm_source=…) on
// landing — runs on every page via the root layout. Persisted in localStorage
// and later stamped onto orders and customer records.
export default function SourceCapture() {
  useEffect(() => { captureSource(); }, []);
  return null;
}
