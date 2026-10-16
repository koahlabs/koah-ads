import type { NextRequest } from "next/server";
import { deviceConnectionStatus, reply, startDeviceConnection } from "@/lib/ad-proxy";
import { signInEnabled } from "@/lib/feature-flags";
import { deviceStore } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  if (!await signInEnabled()) return reply({ error: "Sidequest sign-in is not available" }, 503);
  return startDeviceConnection(request, deviceStore());
}

export async function GET(request: NextRequest) {
  return deviceConnectionStatus(request, deviceStore());
}
