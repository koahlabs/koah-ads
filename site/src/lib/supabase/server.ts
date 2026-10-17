import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { canSignIn } from "@/lib/auth-policy";
import { signInEnabled } from "@/lib/feature-flags";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function createClient({ readOnly = false }: { readOnly?: boolean } = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        // Proxy handles refreshes before Server Components render.
        if (readOnly) return;
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}

type SignedIn = NonNullable<Awaited<ReturnType<typeof signedInClient>>>;

export async function signedInClient() {
  const supabase = await createClient();
  const user = (await supabase?.auth.getUser().catch(() => null))?.data.user;
  return supabase && user ? { supabase, user } : null;
}

// Accounts can be created through Supabase's public auth API, so the invite rule is enforced here too.
export async function allowedClient(known?: SignedIn) {
  const signedIn = known ?? (await signedInClient());
  if (!signedIn) return "session";
  return canSignIn(signedIn.user.email, await signInEnabled()) ? signedIn : "invite_only";
}
