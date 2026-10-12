import "server-only";
import { connection } from "next/server";
import { estimatedPayoutCents, koahPayoutEstimate } from "@/lib/payout-estimate";

export async function getCurrentPayoutEstimate(): Promise<number> {
  await connection();
  return estimatedPayoutCents(koahPayoutEstimate, Date.now());
}
