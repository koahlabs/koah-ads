import type { NextRequest } from "next/server";
import { handleAdRequest } from "@/lib/ad-proxy";
import { deviceStore } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  return handleAdRequest(request, {
    env: process.env,
    fetch,
    ...deviceStore(),
  });
}
