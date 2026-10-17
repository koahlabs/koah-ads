import "server-only";
import { headers } from "next/headers";
import { clientIp } from "@/lib/ad-proxy";
import { authMessages } from "@/lib/auth-policy";
import type { DeviceOs } from "@/lib/dashboard";
import { allowedClient } from "@/lib/supabase/server";

type PendingRequest = {
  code: string;
  ip: string;
  location: string | null;
  os: DeviceOs | null;
  requestedAt: string;
  visitorIp: string | null;
  differentNetwork: boolean;
};
export type LookupState = { message: string; request: PendingRequest | null };

export const invalid = "That code is invalid or expired.";
export const denied = {
  session: "Your session has ended. Sign in again.",
  invite_only: authMessages.invite_only,
};
export const failed = (code?: string) =>
  code === "P0429"
    ? "Too many attempts. Try again in an hour."
    : "We could not connect this computer. Please try again.";

export async function lookupPendingRequest(
  code: string,
  known?: Parameters<typeof allowedClient>[0],
): Promise<LookupState> {
  const signedIn = await allowedClient(known);
  if (typeof signedIn === "string") return { message: denied[signedIn], request: null };
  const visitorIp = clientIp(await headers());
  const { data, error } = await signedIn.supabase.rpc("sidequest_pending_device", {
    p_user_code: code,
    p_visitor_ip: visitorIp,
  });
  if (error) return { message: failed(error.code), request: null };
  const device = data[0];
  if (!device) return { message: invalid, request: null };
  const request = {
    code,
    ip: device.requested_ip,
    location: device.requested_location,
    os: device.os,
    requestedAt: device.created_at,
    visitorIp,
    differentNetwork: !device.same_network,
  };
  return { message: "", request };
}
