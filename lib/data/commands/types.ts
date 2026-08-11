import type { SupabaseClient } from "@supabase/supabase-js";

// Commands are framework-free: they take a Supabase client (the caller decides
// whether it's the request-scoped server client or another) plus plain input,
// perform validation + mutation + notification, and return a Result. They must
// NOT import next/* — cache revalidation stays in the Server Action wrapper.
export type Db = SupabaseClient;

export type Result = { ok: true } | { ok: false; error: string };
