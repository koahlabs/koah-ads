"use server";

import {
  denied,
  failed,
  invalid,
  lookupPendingRequest,
  type LookupState,
} from "@/lib/connect-server";
import { allowedClient } from "@/lib/supabase/server";
import { normalizeUserCode } from "@/lib/user-code";

export type ConfirmState = { message: string; connected: boolean };

export async function lookupCode(_previous: LookupState, formData: FormData): Promise<LookupState> {
  const code = normalizeUserCode(formData.get("code"));
  if (!code) return { message: invalid, request: null };
  return lookupPendingRequest(code);
}

export async function confirmCode(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const code = normalizeUserCode(formData.get("code"));
  if (!code) return { message: invalid, connected: false };
  const signedIn = await allowedClient();
  if (typeof signedIn === "string") return { message: denied[signedIn], connected: false };
  const { data, error } = await signedIn.supabase.rpc("sidequest_confirm_device", {
    p_user_code: code,
  });
  if (error) return { message: failed(error.code), connected: false };
  return data ? { message: "", connected: true } : { message: invalid, connected: false };
}
