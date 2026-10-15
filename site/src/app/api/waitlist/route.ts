import { handleWaitlist } from "@/lib/waitlist";
import { after } from "next/server";
import { notifyWaitlistSignup } from "@/lib/waitlist-slack";
import { track } from "@vercel/analytics/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const env = {
    LOOPS_API_KEY: process.env.LOOPS_API_KEY,
    LOOPS_WAITLIST_TRANSACTIONAL_ID: process.env.LOOPS_WAITLIST_TRANSACTIONAL_ID,
    LOOPS_WAITLIST_MAILING_LIST_ID: process.env.LOOPS_WAITLIST_MAILING_LIST_ID,
    SETTINGS__KOAH_INFO_SLACK_URL: process.env.SETTINGS__KOAH_INFO_SLACK_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  };
  return handleWaitlist(
    request,
    env,
    fetch,
    env.SETTINGS__KOAH_INFO_SLACK_URL
      ? (signup) => after(() => notifyWaitlistSignup(signup, env))
      : undefined,
    () =>
      after(async () => {
        try {
          // Pass the original request for Vercel's session context. Never send email
          // addresses or signup identifiers as custom event properties.
          await track("waitlist_signup", { source: "waitlist_form" }, { request });
        } catch {
          console.error("Sidequest waitlist: analytics tracking failed");
        }
      }),
  );
}
