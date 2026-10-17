import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { fetchUserEarnings } from "@/lib/ad-proxy";
import {
  dashboardFromSources,
  unavailableDashboard,
  type PayoutsRow,
  type SetupStatus,
} from "@/lib/dashboard";

export async function getDashboard(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "created_at">,
) {
  const asOf = new Date().toISOString();
  const today = asOf.slice(0, 10);
  const signedUp = new Date(user.created_at).toISOString().slice(0, 10);
  try {
    const [earnings, payouts] = await Promise.all([
      fetchUserEarnings({ env: process.env, fetch }, user.id, signedUp, today),
      supabase.rpc("sidequest_dashboard"),
    ]);
    if (payouts.error) return unavailableDashboard();
    return dashboardFromSources(earnings, payouts.data as PayoutsRow, asOf);
  } catch {
    return unavailableDashboard();
  }
}

export async function getSetupStatus(supabase: SupabaseClient): Promise<SetupStatus | null> {
  const { data, error } = await supabase.rpc("sidequest_setup_status");
  return error ? null : (data as SetupStatus);
}
