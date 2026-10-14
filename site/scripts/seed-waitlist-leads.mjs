import { readFile } from "node:fs/promises";
import { waitlistHashesFromCsv } from "../src/lib/waitlist-import.ts";
import { seedWaitlistLeadNumbers } from "../src/lib/waitlist-lead-number.ts";

const csvPath = process.argv[2];
if (!csvPath) throw new Error("Provide the path to a Loops contact CSV export.");
const hashes = waitlistHashesFromCsv(await readFile(csvPath, "utf8"));
if (process.argv.includes("--dry-run")) {
  console.log(`The export contains ${hashes.length} unique Sidequest waitlist leads. No provider data was changed.`);
} else {
  const total = await seedWaitlistLeadNumbers(hashes, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  if (total === null) throw new Error("The waitlist counter could not be seeded. Check the server key and apply the waitlist counter migration.");
  console.log(`The waitlist counter includes ${total} leads. No Slack message or email was sent.`);
}
