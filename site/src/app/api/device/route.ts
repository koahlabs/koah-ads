import type { NextRequest } from "next/server";
import { deviceConnectionStatus, startDeviceConnection } from "@/lib/ad-proxy";
import { deviceStore } from "@/lib/supabase/admin";

// No sign-in flag check: a code only connects after a signed-in user confirms it, and sign-in is flag-gated.
export async function POST(request: NextRequest) {
  return startDeviceConnection(request, deviceStore());
}

export async function GET(request: NextRequest) {
  return deviceConnectionStatus(request, deviceStore());
}
