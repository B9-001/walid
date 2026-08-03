// Meta (Facebook) Pixel ID — shared by the browser pixel (components/diamond/
// MetaPixel.tsx) and the server-side Conversions API route (app/api/capi).
//
// Hardcoded on purpose: a pixel ID is public (it ships in the client snippet),
// and hardcoding it makes the correct pixel fire regardless of any stale
// NEXT_PUBLIC_FB_PIXEL_ID env var left over in the hosting config. To change
// pixels, edit this one line.
//
// NOTE: the CAPI *token* (FB_CAPI_TOKEN) is a secret set via env var, and it
// must belong to THIS pixel or the server-side events will be rejected.
export const FB_PIXEL_ID = "1422886952986930";
