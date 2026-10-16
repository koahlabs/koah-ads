import type { NextRequest } from "next/server";
import { handleAuthCallback } from "@/lib/auth-callback";

export const GET = (request: NextRequest) => handleAuthCallback(request, "account");
