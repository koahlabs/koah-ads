import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { fetchUserEarnings } from "@/lib/ad-proxy";
import { dashboardFromSources, unavailableDashboard, type PayoutsRow } from "@/lib/dashboard";

export async function getDashboard(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "created_at">,
) {
  const today = new Date().toISOString().slice(0, 10);
  const signedUp = new Date(user.created_at).toISOString().slice(0, 10);
  try {
    const [earnings, payouts] = await Promise.all([
      fetchUserEarnings({ env: process.env, fetch }, user.id, signedUp, today),
      supabase.rpc("sidequest_dashboard"),
    ]);
    if (payouts.error) return unavailableDashboard();
    return dashboardFromSources(earnings, payouts.data as PayoutsRow, today);
  } catch {
    return unavailableDashboard();
  }
}
