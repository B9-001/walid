import { createClient } from "@supabase/supabase-js";

// These come from NEXT_PUBLIC_* env vars, which Next.js inlines at BUILD time.
// If they're missing at build (e.g. not set in Vercel yet) we fall back to a
// syntactically-valid placeholder so the build can't hard-crash on module load
// during page-data collection. The site still needs the REAL values set in the
// deployment's environment variables to actually reach the database — a missing
// value surfaces as "no data / can't sign in" at runtime instead of a failed deploy.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — " +
      "using placeholders. The app cannot reach the database until these are configured.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
