import type { NextRequest } from "next/server";
import { handleImpression } from "@/lib/ad-proxy";
import { deviceStore } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleImpression(request, id, {
    env: process.env,
    fetch,
    ...deviceStore(),
  });
}
