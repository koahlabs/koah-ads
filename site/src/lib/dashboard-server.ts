import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyDashboard, parseDashboard } from "@/lib/dashboard";

export async function getDashboard(supabase: SupabaseClient) {
  try {
    const { data, error } = await supabase.rpc("sidequest_dashboard");
    if (error) return emptyDashboard();
    return parseDashboard(data);
  } catch {
    return emptyDashboard();
  }
}
