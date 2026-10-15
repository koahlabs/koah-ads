"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/ad-proxy";
import { normalizeUserCode } from "@/lib/user-code";
import { createClient } from "@/lib/supabase/server";

export type PendingRequest = { code: string; ip: string; location: string | null; requestedAt: string; visitorIp: string | null; differentNetwork: boolean };
export type LookupState = { message: string; request: PendingRequest | null };
export type ConfirmState = { message: string; connected: boolean };

const invalid = "That code is invalid or expired.";
const sessionEnded = "Your session has ended. Sign in again.";
const failed = (code?: string) => code === "P0429" ? "Too many attempts. Try again in an hour." : "We could not connect this computer. Please try again.";

async function signedInClient() {
  const supabase = await createClient();
  const user = (await supabase?.auth.getUser().catch(() => null))?.data.user;
  return user ? supabase : null;
}

export async function lookupCode(_previous: LookupState, formData: FormData): Promise<LookupState> {
  const code = normalizeUserCode(formData.get("code"));
  if (!code) return { message: invalid, request: null };
  const supabase = await signedInClient();
  if (!supabase) return { message: sessionEnded, request: null };
  const visitorIp = clientIp(await headers());
  const { data, error } = await supabase.rpc("sidequest_pending_device", { p_user_code: code, p_visitor_ip: visitorIp });
  if (error) return { message: failed(error.code), request: null };
  const device = data[0];
  if (!device) return { message: invalid, request: null };
  const differentNetwork = !device.same_network;
  const request = { code, ip: device.requested_ip, location: device.requested_location, requestedAt: device.created_at, visitorIp, differentNetwork };
  return { message: "", request };
}

export async function confirmCode(_previous: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const code = normalizeUserCode(formData.get("code"));
  if (!code) return { message: invalid, connected: false };
  const supabase = await signedInClient();
  if (!supabase) return { message: sessionEnded, connected: false };
  const { data, error } = await supabase.rpc("sidequest_confirm_device", { p_user_code: code });
  if (error) return { message: failed(error.code), connected: false };
  return data ? { message: "Connected. Return to Claude Code.", connected: true } : { message: invalid, connected: false };
}
