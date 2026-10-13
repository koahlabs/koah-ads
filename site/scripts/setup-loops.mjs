import { readFile, writeFile } from "node:fs/promises";

const apiKey = process.env.LOOPS_API_KEY;
if (!apiKey) throw new Error("Add LOOPS_API_KEY to .env.local first.");
const name = "Sidequest — Waitlist welcome";
const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
async function call(path, method = "GET", body) {
  const response = await fetch(`https://app.loops.so/api/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(`Loops ${method} ${path}: ${response.status} ${data.message || "Request failed"}`);
  return data;
}
async function setEnv(key, value) {
  let content = await readFile(".env.local", "utf8");
  const pattern = new RegExp(`^${key}=.*$`, "m");
  content = pattern.test(content) ? content.replace(pattern, `${key}=${value}`) : `${content.trimEnd()}\n${key}=${value}\n`;
  await writeFile(".env.local", content, { mode: 0o600 });
}

const team = await call("api-key");
console.log(`Connected to Loops team: ${team.teamName}`);
const properties = await call("contacts/properties");
for (const property of [{ name: "muxWaitlistJoinedAt", type: "date" }, { name: "muxWaitlistWelcomeSent", type: "boolean" }, { name: "muxWaitlistSlackNotified", type: "boolean" }]) {
  const existing = properties.find((item) => item.key === property.name);
  if (existing && existing.type !== property.type) throw new Error(`Existing property ${property.name} has an incompatible type.`);
  if (!existing) await call("contacts/properties", "POST", property);
}

let transactionalId = process.env.LOOPS_WAITLIST_TRANSACTIONAL_ID;
if (!transactionalId) {
  let cursor;
  do {
    const result = await call(`transactional-emails?perPage=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    transactionalId = result.data.find((item) => item.name === name)?.id;
    cursor = result.pagination.nextCursor;
  } while (!transactionalId && cursor);
}
if (!transactionalId) {
  const created = await call("transactional-emails", "POST", { name });
  transactionalId = created.id;
}
// Save the ID immediately so a partial failure can resume without duplicate templates.
await setEnv("LOOPS_WAITLIST_TRANSACTIONAL_ID", transactionalId);
const transactional = await call(`transactional-emails/${transactionalId}`);
if (transactional.name !== name) throw new Error("The configured template is not the Sidequest welcome email. Refusing to overwrite it.");
const draft = transactional.draftEmailMessageId ? transactional : await call(`transactional-emails/${transactionalId}/draft`, "POST");
if (!draft.draftEmailMessageId) throw new Error("Loops did not return a draft email message ID.");
const message = await call(`email-messages/${draft.draftEmailMessageId}`);
await call(`email-messages/${draft.draftEmailMessageId}`, "POST", {
  expectedRevisionId: message.contentRevisionId,
  subject: "You’re on the Sidequest waitlist.",
  previewText: "Thanks for joining. We’ll email you when early access opens.",
  fromName: "guard_if at Sidequest",
  fromEmail: process.env.LOOPS_FROM_EMAIL || "noreply",
  emailFormat: "styled",
  lmx: await readFile("emails/waitlist-welcome.lmx", "utf8"),
});
const published = await call(`transactional-emails/${transactionalId}/publish`, "POST");
if (!published.publishedEmailMessageId) throw new Error("Loops did not confirm publication.");
console.log(`Published: https://app.loops.so/transactional/${transactionalId}`);
console.log("Saved LOOPS_WAITLIST_TRANSACTIONAL_ID to .env.local. No email was sent.");
