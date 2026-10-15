import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DeviceStore } from "@/lib/ad-proxy";
import { getSupabaseConfig } from "@/lib/supabase/config";

let client: SupabaseClient | undefined;

export function adminClient() {
  if (client) return client;
  const url = getSupabaseConfig()?.url;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error("Sidequest needs the Supabase URL, a publishable key and SUPABASE_SECRET_KEY.");
  return (client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

async function rpc(fn: string, args: Record<string, string | null>) {
  const { data, error } = await adminClient().rpc(fn, args);
  if (error) throw error;
  return data;
}

export function deviceStore(): DeviceStore {
  adminClient();
  return {
    async findDevice(keyHash) {
      const device = (await rpc("sidequest_device", { p_key_hash: keyHash }))[0];
      return device ? { status: device.status, userId: device.user_id, email: device.email } : null;
    },
    async takeAdRequest(keyHash) {
      const taken = (await rpc("sidequest_take_ad_request", { p_key_hash: keyHash }))[0];
      return taken ? { status: taken.status, userId: taken.user_id } : null;
    },
    startDevice: ({ keyHash, userCode, ip, location }) =>
      rpc("sidequest_start_device", {
        p_key_hash: keyHash,
        p_user_code: userCode,
        p_ip: ip,
        p_location: location,
      }),
  };
}
