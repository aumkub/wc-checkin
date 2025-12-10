import { createClient } from '@supabase/supabase-js';

// Prefer Vite-style env vars, but also support the provided NEXT_PUBLIC_* names.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://vcndshgalsmocinjdsod.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  'sb_publishable_i621usyRUzZuDb8c0JHq_A_srvcmjZm';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please set your env variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);