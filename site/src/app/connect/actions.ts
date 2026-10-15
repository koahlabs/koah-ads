"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/ad-proxy";
import { authMessages, canSignIn } from "@/lib/auth-policy";
import { signInEnabled } from "@/lib/feature-flags";
import { normalizeUserCode } from "@/lib/user-code";
import { signedInClient } from "@/lib/supabase/server";

export type PendingRequest = {
  code: string;
  ip: string;
  location: string | null;
  requestedAt: string;
  visitorIp: string | null;
  differentNetwork: boolean;
};
export type LookupState = { message: string; request: PendingRequest | null };
export type ConfirmState = { message: string; connected: boolean };

const invalid = "That code is invalid or expired.";
const sessionEnded = "Your session has ended. Sign in again.";
const failed = (code?: string) =>
  code === "P0429"
    ? "Too many attempts. Try again in an hour."
    : "We could not connect this computer. Please try again.";

// Accounts can be created through Supabase's public auth API, so the invite rule is enforced here too.
async function allowedClient() {
  const signedIn = await signedInClient();
  if (!signedIn) return sessionEnded;
  return canSignIn(signedIn.user.email, await signInEnabled())
    ? signedIn
    : authMessages.invite_only;
}

export async function lookupCode(_previous: LookupState, formData: FormData): Promise<LookupState> {
  const code = normalizeUserCode(formData.get("code"));
  if (!code) return { message: invalid, request: null };
  const signedIn = await allowedClient();
  if (typeof signedIn === "string") return { message: signedIn, request: null };
  const visitorIp = clientIp(await headers());
  const { data, error } = await signedIn.supabase.rpc("sidequest_pending_device", {
    p_user_code: code,
    p_visitor_ip: visitorIp,
  });
  if (error) return { message: failed(error.code), request: null };
  const device = data[0];
  if (!device) return { message: invalid, request: null };
  const differentNetwork = !device.same_network;
  const request = {
    code,
    ip: device.requested_ip,
    location: device.requested_location,
    requestedAt: device.created_at,
    visitorIp,
    differentNetwork,
  };
  return { message: "", request };
}

export async function confirmCode(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const code = normalizeUserCode(formData.get("code"));
  if (!code) return { message: invalid, connected: false };
  const signedIn = await allowedClient();
  if (typeof signedIn === "string") return { message: signedIn, connected: false };
  const { data, error } = await signedIn.supabase.rpc("sidequest_confirm_device", {
    p_user_code: code,
  });
  if (error) return { message: failed(error.code), connected: false };
  return data
    ? { message: "Connected. Return to Claude Code.", connected: true }
    : { message: invalid, connected: false };
}
