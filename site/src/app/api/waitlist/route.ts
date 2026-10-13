import { handleWaitlist } from "@/lib/waitlist";
import { after } from "next/server";
import { notifyWaitlistSignup } from "@/lib/waitlist-slack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const env = {
    LOOPS_API_KEY: process.env.LOOPS_API_KEY,
    LOOPS_WAITLIST_TRANSACTIONAL_ID: process.env.LOOPS_WAITLIST_TRANSACTIONAL_ID,
    LOOPS_WAITLIST_MAILING_LIST_ID: process.env.LOOPS_WAITLIST_MAILING_LIST_ID,
    SETTINGS__KOAH_INFO_SLACK_URL: process.env.SETTINGS__KOAH_INFO_SLACK_URL,
  };
  return handleWaitlist(request, env, fetch, env.SETTINGS__KOAH_INFO_SLACK_URL
    ? (signup) => after(() => notifyWaitlistSignup(signup, env))
    : undefined);
}
