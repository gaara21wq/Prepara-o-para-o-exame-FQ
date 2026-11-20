import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;

// Sem configuração o site funciona na mesma, só com progresso local.
export const supabase = url && chave
  ? createClient(url, chave, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
