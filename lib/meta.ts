// Meta (Facebook) Pixel ID — shared by the browser pixel (components/diamond/
// MetaPixel.tsx) and the server-side Conversions API route (app/api/capi).
//
// A Pixel ID is public (it ships in the client-side snippet), so we hardcode the
// current one as the default and let NEXT_PUBLIC_FB_PIXEL_ID override it if set.
// This way the pixel works without any env configuration. NOTE: the CAPI *token*
// (FB_CAPI_TOKEN) is a secret and must still be set as an env var, and it must
// belong to THIS pixel or server events will be rejected.
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1422886952986930";
