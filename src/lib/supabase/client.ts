import { createBrowserClient } from "@supabase/ssr";

// Using `any` here because @supabase/ssr v0.5 doesn't support
// the __InternalSupabase field in Supabase-generated types v2.106+.
// Import Database types directly in files that need them for assertions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
