import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function hasSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseConfig()) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);
  }
  return cachedClient;
}

export async function signInWithGitHub(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase environment variables are missing.");
  }
  const redirectTo = new URL(import.meta.env.BASE_URL ?? "/", window.location.origin).toString();
  const { error } = await client.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo
    }
  });
  if (error) {
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}
