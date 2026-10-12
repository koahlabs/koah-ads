import { readFile, writeFile } from "node:fs/promises";

const apiKey = process.env.LOOPS_API_KEY;
if (!apiKey) throw new Error("Add LOOPS_API_KEY to .env.local first.");
const name = "Sidequest — Sign-in link";
async function call(path, method = "GET", body) {
  const response = await fetch(`https://app.loops.so/api/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(`Loops ${method} ${path} failed (${response.status}).`);
  return data;
}

let transactionalId = process.env.LOOPS_AUTH_TRANSACTIONAL_ID;
if (!transactionalId) {
  let cursor;
  do {
    const result = await call(`transactional-emails?perPage=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    transactionalId = result.data.find(item => item.name === name)?.id;
    cursor = result.pagination.nextCursor;
  } while (!transactionalId && cursor);
}
if (!transactionalId) transactionalId = (await call("transactional-emails", "POST", { name })).id;
if (!transactionalId) throw new Error("Loops did not return a template ID.");
let env = await readFile(".env.local", "utf8");
const pattern = /^LOOPS_AUTH_TRANSACTIONAL_ID=.*$/m;
env = pattern.test(env) ? env.replace(pattern, `LOOPS_AUTH_TRANSACTIONAL_ID=${transactionalId}`) : `${env.trimEnd()}\nLOOPS_AUTH_TRANSACTIONAL_ID=${transactionalId}\n`;
await writeFile(".env.local", env, { mode: 0o600 });

const transactional = await call(`transactional-emails/${transactionalId}`);
if (transactional.name !== name) throw new Error("The configured template is not the Sidequest sign-in email. Refusing to overwrite it.");
const draft = transactional.draftEmailMessageId ? transactional : await call(`transactional-emails/${transactionalId}/draft`, "POST");
if (!draft.draftEmailMessageId) throw new Error("Loops did not return a draft message ID.");
const message = await call(`email-messages/${draft.draftEmailMessageId}`);
await call(`email-messages/${draft.draftEmailMessageId}`, "POST", {
  expectedRevisionId: message.contentRevisionId,
  subject: "Your Sidequest sign-in link",
  previewText: "Use this one-time link to sign in.",
  fromName: "Sidequest",
  fromEmail: process.env.LOOPS_FROM_EMAIL || "noreply",
  emailFormat: "styled",
  lmx: await readFile("emails/sign-in-link.lmx", "utf8"),
});
const published = await call(`transactional-emails/${transactionalId}/publish`, "POST");
if (!published.publishedEmailMessageId) throw new Error("Loops did not confirm publication.");
const payload = {
  transactionalId,
  email: "{{ .Email }}",
  dataVariables: { signInUrl: "{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email" },
};
await writeFile("emails/supabase-sign-in.json", `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Published: https://app.loops.so/transactional/${transactionalId}`);
console.log("Saved the Supabase Confirm signup and Magic Link payload to emails/supabase-sign-in.json. No email was sent.");
