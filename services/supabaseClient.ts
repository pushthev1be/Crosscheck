import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Guard against placeholder or empty URL to avoid crashing at startup
const isValidUrl = (url: string) => {
    try {
        return url && url.startsWith('http') && !url.includes('YOUR_SUPABASE_URL') && !url.includes('your-project');
    } catch {
        return false;
    }
};

const noopChain: any = {
    upsert: () => Promise.resolve({ error: null }),
    insert: () => Promise.resolve({ error: null }),
    update: () => noopChain,
    delete: () => noopChain,
    select: () => noopChain,
    eq: () => noopChain,
    neq: () => noopChain,
    order: () => Promise.resolve({ data: [], error: null }),
    match: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    then: undefined,
};

export const supabase = isValidUrl(supabaseUrl)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : {
        from: () => noopChain,
        auth: {
            getSession: () => Promise.resolve({ data: { session: null } }),
            signOut: () => Promise.resolve({}),
            signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
            signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        }
    } as any;
