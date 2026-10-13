const apiKey = process.env.LOOPS_API_KEY;
if (!apiKey) throw new Error("Add LOOPS_API_KEY to .env.local first.");
const url = "https://app.loops.so/api/v1/contacts/properties";
const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
if (!response.ok) throw new Error(`Loops property lookup failed: ${response.status}`);
const properties = await response.json();
if (!Array.isArray(properties)) throw new Error("Invalid Loops property response.");
const existing = properties.find((property) => property.key === "muxWaitlistSlackNotified");
if (existing && existing.type !== "boolean") throw new Error("The Slack delivery property has an incompatible type.");
if (!existing) {
  const created = await fetch(url, {
    method: "POST", headers,
    body: JSON.stringify({ name: "muxWaitlistSlackNotified", type: "boolean" }),
    signal: AbortSignal.timeout(10000),
  });
  if (!created.ok || (await created.json()).success !== true) throw new Error(`Loops property creation failed: ${created.status}`);
}
console.log("The Loops Slack delivery property is ready. No email or Slack message was sent.");
