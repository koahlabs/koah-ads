import { handleWaitlist } from "@/lib/waitlist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleWaitlist(request, {
    LOOPS_API_KEY: process.env.LOOPS_API_KEY,
    LOOPS_WAITLIST_TRANSACTIONAL_ID: process.env.LOOPS_WAITLIST_TRANSACTIONAL_ID,
    LOOPS_WAITLIST_MAILING_LIST_ID: process.env.LOOPS_WAITLIST_MAILING_LIST_ID,
  });
}
